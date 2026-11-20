package com.example.data

import androidx.annotation.Keep
import com.example.ai.MealItem
import com.example.ai.MealPlanResult
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp

@Keep
@IgnoreExtraProperties
data class UserProfileDoc(
    @DocumentId val id: String = "",
    val userId: String = "",
    val displayName: String = "",
    val email: String = "",
    val photoUrl: String? = null,
    val goal: String = "کاهش وزن و چربی‌سوزی",
    val mealCount: Long = 4L,
    val bodyStats: String = "",
    val preferredFoods: String = "",
    val restrictions: String = "",
    val extraNotes: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class SavedMealItemDoc(
    val mealTitle: String = "",
    val timeRange: String = "",
    val foods: List<String> = emptyList(),
    val calories: Long = 0L,
    val proteinGrams: Long = 0L,
    val carbsGrams: Long = 0L,
    val fatGrams: Long = 0L,
    val notes: String = ""
) {
    fun toDomainMealItem(): MealItem = MealItem(
        mealTitle = mealTitle,
        timeRange = timeRange,
        foods = foods,
        calories = calories.toInt(),
        proteinGrams = proteinGrams.toInt(),
        carbsGrams = carbsGrams.toInt(),
        fatGrams = fatGrams.toInt(),
        notes = notes
    )
}

@Keep
@IgnoreExtraProperties
data class SavedMealPlanDoc(
    @DocumentId val id: String = "",
    val userId: String = "",
    val goal: String = "",
    val mealCount: Long = 4L,
    val planTitle: String = "",
    val summary: String = "",
    val dailyCalories: Long = 0L,
    val proteinTarget: String = "",
    val carbsTarget: String = "",
    val fatTarget: String = "",
    val hydrationTip: String = "",
    val coachTip: String = "",
    val meals: List<SavedMealItemDoc> = emptyList(),
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
) {
    fun toDomainMealPlanResult(): MealPlanResult = MealPlanResult(
        planTitle = planTitle,
        summary = summary,
        dailyCalories = dailyCalories.toInt(),
        proteinTarget = proteinTarget,
        carbsTarget = carbsTarget,
        fatTarget = fatTarget,
        hydrationTip = hydrationTip,
        coachTip = coachTip,
        meals = meals.map { it.toDomainMealItem() }
    )
}

enum class ProgressLogCategory(val raw: String) {
    WORKOUT("WORKOUT"),
    MILESTONE("MILESTONE");

    companion object {
        fun fromRaw(raw: String?): ProgressLogCategory =
            entries.firstOrNull { it.raw == raw } ?: WORKOUT
    }
}

data class NewProgressLogRequest(
    val category: ProgressLogCategory,
    val title: String,
    val durationMinutes: Int,
    val readinessScore: Int,
    val weightTenthsKg: Int,
    val sessionDateIso: String,
    val notes: String
)

@Keep
@IgnoreExtraProperties
data class WorkoutProgressLogDoc(
    @DocumentId val id: String = "",
    val userId: String = "",
    val category: String = ProgressLogCategory.WORKOUT.raw,
    val title: String = "",
    val durationMinutes: Long = 0L,
    val readinessScore: Long = 80L,
    val weightTenthsKg: Long = 0L,
    val sessionDateIso: String = "",
    val notes: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
) {
    fun resolvedCategory(): ProgressLogCategory = ProgressLogCategory.fromRaw(category)

    fun weightKgOrNull(): Double? =
        if (weightTenthsKg in 200L..3000L) weightTenthsKg.toDouble() / 10.0 else null
}
