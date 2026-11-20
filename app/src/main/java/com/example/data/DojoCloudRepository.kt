package com.example.data

import android.content.Context
import com.example.R
import com.example.ai.MealPlanRequest
import com.example.ai.MealPlanResult
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await

private const val DEFAULT_GOAL = "کاهش وزن و چربی‌سوزی"

class DojoCloudRepository(
    private val db: FirebaseFirestore,
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
) {
    constructor(context: Context) : this(
        FirebaseFirestore.getInstance(
            context.applicationContext.getString(R.string.firestore_database_id)
        )
    )

    private fun requireUserId(): String {
        val uid = auth.currentUser?.uid
        check(!uid.isNullOrBlank()) {
            "User must be signed in with Google before accessing Firestore."
        }
        return uid
    }

    fun observeUserProfile(userId: String): Flow<UserProfileDoc?> = flow {
        val uid = requireUserId()
        check(uid == userId) { "Signed-in user mismatch while observing profile." }
        val docRef = db.collection("users").document(uid)
        emitAll(
            docRef.snapshots()
                .map { snapshot ->
                    if (snapshot.exists()) {
                        snapshot.toObject(
                            UserProfileDoc::class.java,
                            DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                        )
                    } else {
                        null
                    }
                }
                .catch { error ->
                    val firestoreError = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (firestoreError == null && error is CancellationException) throw error
                    val exceptionToLog = firestoreError ?: (error as? Exception)
                    if (exceptionToLog != null && auth.currentUser?.uid == uid) {
                        handleFirestoreError(exceptionToLog, OperationType.GET, docRef.path)
                    }
                    throw error
                }
        )
    }

    fun observeMealPlans(userId: String): Flow<List<SavedMealPlanDoc>> = flow {
        val uid = requireUserId()
        check(uid == userId) { "Signed-in user mismatch while observing meal plans." }
        val colRef = db.collection("users").document(uid).collection("mealPlans")
        emitAll(
            colRef.orderBy("createdAt", Query.Direction.DESCENDING)
                .limit(50)
                .snapshots()
                .map { snapshot ->
                    snapshot.toObjects(
                        SavedMealPlanDoc::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    )
                }
                .catch { error ->
                    val firestoreError = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (firestoreError == null && error is CancellationException) throw error
                    val exceptionToLog = firestoreError ?: (error as? Exception)
                    if (exceptionToLog != null && auth.currentUser?.uid == uid) {
                        handleFirestoreError(exceptionToLog, OperationType.LIST, colRef.path)
                    }
                    throw error
                }
        )
    }

    fun observeProgressLogs(userId: String): Flow<List<WorkoutProgressLogDoc>> = flow {
        val uid = requireUserId()
        check(uid == userId) { "Signed-in user mismatch while observing progress logs." }
        val colRef = db.collection("users").document(uid).collection("progressLogs")
        emitAll(
            colRef.orderBy("createdAt", Query.Direction.DESCENDING)
                .limit(100)
                .snapshots()
                .map { snapshot ->
                    snapshot.toObjects(
                        WorkoutProgressLogDoc::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    )
                }
                .catch { error ->
                    val firestoreError = generateSequence(error) { it.cause }
                        .filterIsInstance<FirebaseFirestoreException>()
                        .firstOrNull()
                    if (firestoreError == null && error is CancellationException) throw error
                    val exceptionToLog = firestoreError ?: (error as? Exception)
                    if (exceptionToLog != null && auth.currentUser?.uid == uid) {
                        handleFirestoreError(exceptionToLog, OperationType.LIST, colRef.path)
                    }
                    throw error
                }
        )
    }

    suspend fun syncSignedInUserProfile(user: FirebaseUser): Result<Unit> {
        var docPath = "users/${user.uid}"
        return try {
            val uid = requireUserId()
            check(uid == user.uid) { "Signed-in user changed; refusing cross-user write." }
            val docRef = db.collection("users").document(uid)
            docPath = docRef.path

            val displayName = (user.displayName ?: "").trim().take(120)
            val email = (user.email ?: "").trim().take(200)
            val photoUrl = user.photoUrl?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.take(500)

            val existing = docRef.get().await()
            if (!existing.exists()) {
                val createPayload = buildMap<String, Any> {
                    put("userId", uid)
                    put("displayName", displayName)
                    put("email", email)
                    if (photoUrl != null) put("photoUrl", photoUrl)
                    put("goal", DEFAULT_GOAL)
                    put("mealCount", 4L)
                    put("bodyStats", "")
                    put("preferredFoods", "")
                    put("restrictions", "")
                    put("extraNotes", "")
                    put("createdAt", FieldValue.serverTimestamp())
                    put("updatedAt", FieldValue.serverTimestamp())
                }
                docRef.set(createPayload).await()
            } else {
                val updatePayload = buildMap<String, Any> {
                    put("displayName", displayName)
                    put("email", email)
                    if (photoUrl != null) put("photoUrl", photoUrl)
                    put("updatedAt", FieldValue.serverTimestamp())
                }
                docRef.update(updatePayload).await()
            }
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, docPath)
            Result.failure(e)
        }
    }

    suspend fun saveDietaryPreferences(
        userId: String,
        request: MealPlanRequest
    ): Result<Unit> {
        var docPath = "users/$userId"
        return try {
            val uid = requireUserId()
            check(uid == userId) { "Signed-in user changed; refusing cross-user write." }
            val docRef = db.collection("users").document(uid)
            docPath = docRef.path

            val goal = request.goal.trim().ifBlank { DEFAULT_GOAL }.take(120)
            val mealCount = request.mealCount.coerceIn(1, 10).toLong()
            val bodyStats = request.bodyStats.trim().take(400)
            val preferredFoods = request.preferredFoods.trim().take(500)
            val restrictions = request.restrictions.trim().take(400)
            val extraNotes = request.extraNotes.trim().take(500)

            val existing = docRef.get().await()
            if (!existing.exists()) {
                val user = auth.currentUser
                val photoUrl = user?.photoUrl?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.take(500)
                val createPayload = buildMap<String, Any> {
                    put("userId", uid)
                    put("displayName", (user?.displayName ?: "").trim().take(120))
                    put("email", (user?.email ?: "").trim().take(200))
                    if (photoUrl != null) put("photoUrl", photoUrl)
                    put("goal", goal)
                    put("mealCount", mealCount)
                    put("bodyStats", bodyStats)
                    put("preferredFoods", preferredFoods)
                    put("restrictions", restrictions)
                    put("extraNotes", extraNotes)
                    put("createdAt", FieldValue.serverTimestamp())
                    put("updatedAt", FieldValue.serverTimestamp())
                }
                docRef.set(createPayload).await()
            } else {
                docRef.update(
                    mapOf(
                        "goal" to goal,
                        "mealCount" to mealCount,
                        "bodyStats" to bodyStats,
                        "preferredFoods" to preferredFoods,
                        "restrictions" to restrictions,
                        "extraNotes" to extraNotes,
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            }
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun saveMealPlan(
        userId: String,
        request: MealPlanRequest,
        plan: MealPlanResult
    ): Result<String> {
        var docPath = "users/$userId/mealPlans"
        return try {
            val uid = requireUserId()
            check(uid == userId) { "Signed-in user changed; refusing cross-user write." }
            val docRef = db.collection("users").document(uid).collection("mealPlans").document()
            docPath = docRef.path

            val boundedMeals = plan.meals.take(10).ifEmpty {
                listOf(
                    com.example.ai.MealItem(
                        mealTitle = "وعده اصلی",
                        timeRange = "",
                        foods = listOf(plan.summary.ifBlank { "برنامه روزانه" }),
                        calories = plan.dailyCalories,
                        proteinGrams = 0,
                        carbsGrams = 0,
                        fatGrams = 0,
                        notes = ""
                    )
                )
            }

            val mealsPayload = boundedMeals.map { meal ->
                mapOf(
                    "mealTitle" to meal.mealTitle.trim().take(120),
                    "timeRange" to meal.timeRange.trim().take(80),
                    "foods" to meal.foods.take(20).map { it.trim().take(200) },
                    "calories" to meal.calories.coerceIn(0, 10000).toLong(),
                    "proteinGrams" to meal.proteinGrams.coerceIn(0, 2000).toLong(),
                    "carbsGrams" to meal.carbsGrams.coerceIn(0, 2000).toLong(),
                    "fatGrams" to meal.fatGrams.coerceIn(0, 2000).toLong(),
                    "notes" to meal.notes.trim().take(400)
                )
            }

            val payload = mapOf(
                "userId" to uid,
                "goal" to request.goal.trim().ifBlank { DEFAULT_GOAL }.take(120),
                "mealCount" to request.mealCount.coerceIn(1, 10).toLong(),
                "planTitle" to plan.planTitle.trim().ifBlank { "برنامه غذایی هوشمند" }.take(200),
                "summary" to plan.summary.trim().take(1000),
                "dailyCalories" to plan.dailyCalories.coerceIn(0, 15000).toLong(),
                "proteinTarget" to plan.proteinTarget.trim().take(80),
                "carbsTarget" to plan.carbsTarget.trim().take(80),
                "fatTarget" to plan.fatTarget.trim().take(80),
                "hydrationTip" to plan.hydrationTip.trim().take(1000),
                "coachTip" to plan.coachTip.trim().take(1000),
                "meals" to mealsPayload,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )

            docRef.set(payload).await()
            Result.success(docRef.id)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun saveProgressLog(
        userId: String,
        input: NewProgressLogRequest
    ): Result<String> {
        var docPath = "users/$userId/progressLogs"
        return try {
            val uid = requireUserId()
            check(uid == userId) { "Signed-in user changed; refusing cross-user write." }
            val trimmedTitle = input.title.trim().take(120)
            require(trimmedTitle.isNotEmpty()) { "Title cannot be empty" }

            val dateIso = input.sessionDateIso.trim().let { raw ->
                if (Regex("""^\d{4}-\d{2}-\d{2}$""").matches(raw)) raw
                else com.example.util.JalaliCalendar.todayDateIso()
            }
            val duration = input.durationMinutes.coerceIn(0, 600).toLong()
            val readiness = input.readinessScore.coerceIn(1, 100).toLong()
            val weightTenths = if (input.weightTenthsKg in 200..3000) {
                input.weightTenthsKg.toLong()
            } else {
                0L
            }
            val notes = input.notes.trim().take(500)

            val docRef = db.collection("users").document(uid).collection("progressLogs").document()
            docPath = docRef.path

            val payload = mapOf(
                "userId" to uid,
                "category" to input.category.raw,
                "title" to trimmedTitle,
                "durationMinutes" to duration,
                "readinessScore" to readiness,
                "weightTenthsKg" to weightTenths,
                "sessionDateIso" to dateIso,
                "notes" to notes,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            docRef.set(payload).await()
            Result.success(docRef.id)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }
}
