package com.example.ai

data class MealPlanRequest(
    val goal: String,
    val mealCount: Int,
    val bodyStats: String,
    val preferredFoods: String,
    val restrictions: String,
    val extraNotes: String
)

data class MealItem(
    val mealTitle: String,
    val timeRange: String,
    val foods: List<String>,
    val calories: Int,
    val proteinGrams: Int,
    val carbsGrams: Int,
    val fatGrams: Int,
    val notes: String
)

data class MealPlanResult(
    val planTitle: String,
    val summary: String,
    val dailyCalories: Int,
    val proteinTarget: String,
    val carbsTarget: String,
    val fatTarget: String,
    val hydrationTip: String,
    val coachTip: String,
    val meals: List<MealItem>
) {
    fun macroBreakdown(): MacroBreakdownSummary {
        val mealProtein = meals.sumOf { it.proteinGrams.coerceAtLeast(0) }
        val mealCarbs = meals.sumOf { it.carbsGrams.coerceAtLeast(0) }
        val mealFat = meals.sumOf { it.fatGrams.coerceAtLeast(0) }

        val hasMealMacros = mealProtein > 0 || mealCarbs > 0 || mealFat > 0
        val proteinG = if (hasMealMacros) mealProtein else extractLeadingInt(proteinTarget)
        val carbsG = if (hasMealMacros) mealCarbs else extractLeadingInt(carbsTarget)
        val fatG = if (hasMealMacros) mealFat else extractLeadingInt(fatTarget)

        val proteinKcal = proteinG * 4
        val carbsKcal = carbsG * 4
        val fatKcal = fatG * 9
        val totalMacroKcal = proteinKcal + carbsKcal + fatKcal
        val totalGrams = proteinG + carbsG + fatG

        return MacroBreakdownSummary(
            protein = MacroSliceStats(
                type = MacroType.PROTEIN,
                grams = proteinG,
                calories = proteinKcal,
                caloriePercent = percentOf(proteinKcal, totalMacroKcal),
                gramPercent = percentOf(proteinG, totalGrams)
            ),
            carbs = MacroSliceStats(
                type = MacroType.CARBS,
                grams = carbsG,
                calories = carbsKcal,
                caloriePercent = percentOf(carbsKcal, totalMacroKcal),
                gramPercent = percentOf(carbsG, totalGrams)
            ),
            fats = MacroSliceStats(
                type = MacroType.FATS,
                grams = fatG,
                calories = fatKcal,
                caloriePercent = percentOf(fatKcal, totalMacroKcal),
                gramPercent = percentOf(fatG, totalGrams)
            ),
            totalMacroCalories = totalMacroKcal,
            totalGrams = totalGrams,
            hasPerMealMacros = hasMealMacros
        )
    }

    fun toShareableText(): String = buildString {
        appendLine(planTitle)
        appendLine(summary)
        appendLine("کالری روزانه: $dailyCalories کیلوکالری | پروتئین: $proteinTarget | کربوهیدرات: $carbsTarget | چربی: $fatTarget")
        appendLine()
        meals.forEach { meal ->
            appendLine("• ${meal.mealTitle} (${meal.timeRange}) — ${meal.calories} کیلوکالری")
            meal.foods.forEach { food ->
                appendLine("  - $food")
            }
            if (meal.notes.isNotBlank()) {
                appendLine("  نکته: ${meal.notes}")
            }
            appendLine()
        }
        if (hydrationTip.isNotBlank()) {
            appendLine("نوشیدنی و آب: $hydrationTip")
        }
        if (coachTip.isNotBlank()) {
            appendLine("توصیه مربی: $coachTip")
        }
    }.trim()
}

enum class MacroType {
    PROTEIN,
    CARBS,
    FATS
}

data class MacroSliceStats(
    val type: MacroType,
    val grams: Int,
    val calories: Int,
    val caloriePercent: Float,
    val gramPercent: Float
)

data class MacroBreakdownSummary(
    val protein: MacroSliceStats,
    val carbs: MacroSliceStats,
    val fats: MacroSliceStats,
    val totalMacroCalories: Int,
    val totalGrams: Int,
    val hasPerMealMacros: Boolean
) {
    val slices: List<MacroSliceStats> = listOf(protein, carbs, fats)
    val hasData: Boolean = totalGrams > 0
}

private fun percentOf(part: Int, total: Int): Float {
    if (total <= 0) return 0f
    return (part * 100f) / total.toFloat()
}

internal fun extractLeadingInt(text: String): Int {
    if (text.isBlank()) return 0
    val normalized = buildString(text.length) {
        for (ch in text) {
            when (ch) {
                in '0'..'9' -> append(ch)
                in '۰'..'۹' -> append(('0'.code + (ch.code - '۰'.code)).toChar())
                in '٠'..'٩' -> append(('0'.code + (ch.code - '٠'.code)).toChar())
                else -> append(' ')
            }
        }
    }
    val match = Regex("""\d+""").find(normalized) ?: return 0
    return match.value.toIntOrNull() ?: 0
}

sealed interface MealPlanUiState {
    data object Idle : MealPlanUiState
    data object Loading : MealPlanUiState
    data class Success(val plan: MealPlanResult) : MealPlanUiState
    data class Error(val message: String) : MealPlanUiState
}
