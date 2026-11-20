package com.example.ai

import android.content.Context
import android.util.Log
import com.example.R
import com.example.util.isCurrentlyConnected
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.Schema
import com.google.firebase.ai.type.generationConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

private const val TAG = "GeminiAiClient"
private const val DEFAULT_TIMEOUT_MS = 60_000L

sealed interface AiResponseState {
    data object Idle : AiResponseState
    data object Loading : AiResponseState
    data class Streaming(val text: String) : AiResponseState
    data class Success(val text: String) : AiResponseState
    data class Error(val message: String) : AiResponseState
}

class GeminiAiClient(
    private val context: Context,
    modelName: String = "gemini-3.8-flash"
) {
    private val appContext = context.applicationContext

    private val model by lazy {
        Firebase.ai.generativeModel(modelName)
    }

    private val mealPlanSchema by lazy {
        Schema.obj(
            properties = mapOf(
                "planTitle" to Schema.string(description = "Title of the personalized Persian meal plan"),
                "summary" to Schema.string(description = "Brief 1-2 sentence overview in Persian tailored to the user's goal"),
                "dailyCalories" to Schema.integer(description = "Estimated total daily calories in kcal"),
                "proteinTarget" to Schema.string(description = "Daily protein target in Persian, e.g. 140 گرم"),
                "carbsTarget" to Schema.string(description = "Daily carbs target in Persian, e.g. 220 گرم"),
                "fatTarget" to Schema.string(description = "Daily fat target in Persian, e.g. 60 گرم"),
                "hydrationTip" to Schema.string(description = "Practical daily hydration guidance in Persian"),
                "coachTip" to Schema.string(description = "Practical nutrition and training timing tip in Persian"),
                "meals" to Schema.array(
                    items = Schema.obj(
                        properties = mapOf(
                            "mealTitle" to Schema.string(description = "Meal name in Persian e.g. صبحانه، ناهار، شام"),
                            "timeRange" to Schema.string(description = "Suggested time window in Persian e.g. ۷:۳۰ تا ۸:۳۰"),
                            "foods" to Schema.array(
                                items = Schema.string(),
                                description = "List of foods with exact practical portions in Persian"
                            ),
                            "calories" to Schema.integer(description = "Meal calories in kcal"),
                            "proteinGrams" to Schema.integer(description = "Estimated protein grams"),
                            "carbsGrams" to Schema.integer(description = "Estimated carbs grams"),
                            "fatGrams" to Schema.integer(description = "Estimated fat grams"),
                            "notes" to Schema.string(description = "Short preparation or substitution tip in Persian")
                        ),
                        optionalProperties = listOf("notes")
                    ),
                    description = "Ordered list of daily meals matching the requested meal count"
                )
            ),
            optionalProperties = listOf("hydrationTip", "coachTip")
        )
    }

    private val mealPlanModel by lazy {
        Firebase.ai.generativeModel(
            modelName = modelName,
            generationConfig = generationConfig {
                responseMimeType = "application/json"
                responseSchema = mealPlanSchema
            }
        )
    }

    suspend fun generateMealPlan(request: MealPlanRequest): MealPlanUiState {
        if (!isCurrentlyConnected(appContext)) {
            return MealPlanUiState.Error(appContext.getString(R.string.error_gemini_offline))
        }
        val prompt = buildMealPlanPrompt(request)
        return try {
            val response = withTimeout(DEFAULT_TIMEOUT_MS) {
                mealPlanModel.generateContent(prompt)
            }
            val jsonText = response.text
                ?: return MealPlanUiState.Error(appContext.getString(R.string.error_gemini_generic))
            val parsed = parseMealPlanJson(jsonText)
            MealPlanUiState.Success(parsed)
        } catch (e: TimeoutCancellationException) {
            Log.e(TAG, "Meal plan generation timed out", e)
            MealPlanUiState.Error(appContext.getString(R.string.error_gemini_timeout))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Meal plan generation failed", e)
            MealPlanUiState.Error(toUserFriendlyMessage(e))
        }
    }

    private fun buildMealPlanPrompt(request: MealPlanRequest): String = buildString {
        appendLine("تو یک متخصص تغذیه ورزشی و مربی حرفه‌ای باشگاه ارسلان دوجو هستی.")
        appendLine("یک برنامه غذایی روزانه دقیق، عملی، خوش‌خوراک و کاملاً فارسی بر اساس درخواست زیر طراحی کن.")
        appendLine("قوانین مهم:")
        appendLine("1. دقیقاً ${request.mealCount} وعده غذایی طراحی کن.")
        appendLine("2. اندازه‌ها را با واحدهای واقعی و ملموس (گرم، قاشق، لیوان، عدد، کف دست) بنویس.")
        appendLine("3. به غذاهای مورد علاقه و محدودیت‌های کاربر کاملاً پایبند باش.")
        appendLine("4. اگر کاربر غذای در دسترس مشخص کرده، برنامه را با اولویت همان مواد غذایی بچین.")
        appendLine("5. مقادیر عددی proteinGrams، carbsGrams، fatGrams و calories را برای هر وعده دقیق و واقعی (بزرگ‌تر از صفر) محاسبه و پر کن تا مجموع آن‌ها با اهداف روزانه هم‌خوانی داشته باشد.")
        appendLine()
        appendLine("هدف کاربر: ${request.goal}")
        if (request.bodyStats.isNotBlank()) {
            appendLine("مشخصات بدنی و سطح فعالیت: ${request.bodyStats.trim()}")
        }
        if (request.preferredFoods.isNotBlank()) {
            appendLine("غذاهای دلخواه یا در دسترس: ${request.preferredFoods.trim()}")
        }
        if (request.restrictions.isNotBlank()) {
            appendLine("محدودیت‌ها و غذاهایی که مصرف نمی‌شود: ${request.restrictions.trim()}")
        }
        if (request.extraNotes.isNotBlank()) {
            appendLine("توضیحات اضافی کاربر: ${request.extraNotes.trim()}")
        }
    }

    private fun parseMealPlanJson(jsonString: String): MealPlanResult {
        val json = JSONObject(jsonString)
        val mealsJson = json.getJSONArray("meals")
        val meals = (0 until mealsJson.length()).map { idx ->
            val obj = mealsJson.getJSONObject(idx)
            val foodsArray = obj.getJSONArray("foods")
            val foods = (0 until foodsArray.length()).map { fIdx ->
                foodsArray.getString(fIdx)
            }
            MealItem(
                mealTitle = obj.getString("mealTitle"),
                timeRange = obj.optString("timeRange", ""),
                foods = foods,
                calories = obj.optInt("calories", 0),
                proteinGrams = obj.optInt("proteinGrams", 0),
                carbsGrams = obj.optInt("carbsGrams", 0),
                fatGrams = obj.optInt("fatGrams", 0),
                notes = obj.optString("notes", "")
            )
        }
        return MealPlanResult(
            planTitle = json.getString("planTitle"),
            summary = json.getString("summary"),
            dailyCalories = json.optInt("dailyCalories", 0),
            proteinTarget = json.optString("proteinTarget", ""),
            carbsTarget = json.optString("carbsTarget", ""),
            fatTarget = json.optString("fatTarget", ""),
            hydrationTip = json.optString("hydrationTip", ""),
            coachTip = json.optString("coachTip", ""),
            meals = meals
        )
    }

    suspend fun generateText(prompt: String): AiResponseState {
        if (!isCurrentlyConnected(appContext)) {
            return AiResponseState.Error(appContext.getString(R.string.error_gemini_offline))
        }
        return try {
            val response = withTimeout(DEFAULT_TIMEOUT_MS) {
                model.generateContent(prompt)
            }
            val text = response.text
            if (!text.isNullOrBlank()) {
                AiResponseState.Success(text)
            } else {
                AiResponseState.Error(appContext.getString(R.string.error_gemini_generic))
            }
        } catch (e: TimeoutCancellationException) {
            Log.e(TAG, "Generation timed out", e)
            AiResponseState.Error(appContext.getString(R.string.error_gemini_timeout))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.e(TAG, "Firebase AI generation failed", e)
            AiResponseState.Error(toUserFriendlyMessage(e))
        }
    }

    fun streamText(prompt: String): Flow<AiResponseState> = flow {
        if (!isCurrentlyConnected(appContext)) {
            emit(AiResponseState.Error(appContext.getString(R.string.error_gemini_offline)))
            return@flow
        }
        emit(AiResponseState.Loading)
        val accumulated = StringBuilder()
        withTimeout(DEFAULT_TIMEOUT_MS) {
            model.generateContentStream(prompt).collect { chunk ->
                val chunkText = chunk.text.orEmpty()
                if (chunkText.isNotEmpty()) {
                    accumulated.append(chunkText)
                    emit(AiResponseState.Streaming(accumulated.toString()))
                }
            }
        }
        if (accumulated.isNotBlank()) {
            emit(AiResponseState.Success(accumulated.toString()))
        } else {
            emit(AiResponseState.Error(appContext.getString(R.string.error_gemini_generic)))
        }
    }.catch { e ->
        when (e) {
            is CancellationException -> throw e
            is TimeoutCancellationException -> {
                Log.e(TAG, "Streaming timed out", e)
                emit(AiResponseState.Error(appContext.getString(R.string.error_gemini_timeout)))
            }
            else -> {
                Log.e(TAG, "Streaming generation failed", e)
                emit(AiResponseState.Error(toUserFriendlyMessage(e)))
            }
        }
    }

    private fun toUserFriendlyMessage(error: Throwable): String {
        if (!isCurrentlyConnected(appContext)) {
            return appContext.getString(R.string.error_gemini_offline)
        }
        val msg = error.message?.lowercase().orEmpty()
        val cause = error.cause
        return when {
            error is UnknownHostException ||
                error is ConnectException ||
                cause is UnknownHostException ||
                cause is ConnectException ||
                msg.contains("unable to resolve host") ||
                msg.contains("network") -> {
                appContext.getString(R.string.error_gemini_offline)
            }
            error is SocketTimeoutException ||
                cause is SocketTimeoutException ||
                msg.contains("timeout") -> {
                appContext.getString(R.string.error_gemini_timeout)
            }
            msg.contains("429") || msg.contains("quota") || msg.contains("resource_exhausted") -> {
                appContext.getString(R.string.error_gemini_quota)
            }
            msg.contains("403") ||
                msg.contains("app check") ||
                msg.contains("unavailable") ||
                msg.contains("503") ||
                error is IOException -> {
                appContext.getString(R.string.error_gemini_unavailable)
            }
            else -> appContext.getString(R.string.error_gemini_generic)
        }
    }
}
