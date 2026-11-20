package com.example.ai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MealPlanModelsTest {

    @Test
    fun macroBreakdown_aggregatesPerMealMacrosAndCalculatesCalories() {
        val plan = MealPlanResult(
            planTitle = "برنامه عضله‌سازی",
            summary = "تغذیه متعادل",
            dailyCalories = 2100,
            proteinTarget = "150 گرم",
            carbsTarget = "200 گرم",
            fatTarget = "65 گرم",
            hydrationTip = "",
            coachTip = "",
            meals = listOf(
                MealItem("صبحانه", "۸:۰۰", listOf("تخم‌مرغ"), 500, proteinGrams = 35, carbsGrams = 45, fatGrams = 18, notes = ""),
                MealItem("ناهار", "۱۳:۰۰", listOf("مرغ و برنج"), 850, proteinGrams = 60, carbsGrams = 95, fatGrams = 22, notes = ""),
                MealItem("شام", "۲۰:۰۰", listOf("ماهی"), 650, proteinGrams = 55, carbsGrams = 60, fatGrams = 20, notes = "")
            )
        )

        val breakdown = plan.macroBreakdown()
        assertTrue(breakdown.hasData)
        assertTrue(breakdown.hasPerMealMacros)
        assertEquals(150, breakdown.protein.grams)
        assertEquals(200, breakdown.carbs.grams)
        assertEquals(60, breakdown.fats.grams)
        assertEquals(600, breakdown.protein.calories)
        assertEquals(800, breakdown.carbs.calories)
        assertEquals(540, breakdown.fats.calories)
        assertEquals(1940, breakdown.totalMacroCalories)
        assertEquals(410, breakdown.totalGrams)
    }

    @Test
    fun macroBreakdown_fallsBackToPersianDigitTargetsWhenMealMacrosAreZero() {
        val plan = MealPlanResult(
            planTitle = "رژیم کاهش وزن",
            summary = "ساده",
            dailyCalories = 1600,
            proteinTarget = "۱۲۰ گرم",
            carbsTarget = "۱۵۰ گرم",
            fatTarget = "۵۰ گرم",
            hydrationTip = "",
            coachTip = "",
            meals = listOf(
                MealItem("وعده اول", "۹:۰۰", listOf("نان و پنیر"), 400, proteinGrams = 0, carbsGrams = 0, fatGrams = 0, notes = "")
            )
        )

        val breakdown = plan.macroBreakdown()
        assertTrue(breakdown.hasData)
        assertFalse(breakdown.hasPerMealMacros)
        assertEquals(120, breakdown.protein.grams)
        assertEquals(150, breakdown.carbs.grams)
        assertEquals(50, breakdown.fats.grams)
        assertEquals(480 + 600 + 450, breakdown.totalMacroCalories)
    }

    @Test
    fun macroBreakdown_reportsNoDataWhenAllValuesAreEmpty() {
        val plan = MealPlanResult(
            planTitle = "خالی",
            summary = "",
            dailyCalories = 0,
            proteinTarget = "",
            carbsTarget = "",
            fatTarget = "",
            hydrationTip = "",
            coachTip = "",
            meals = emptyList()
        )

        val breakdown = plan.macroBreakdown()
        assertFalse(breakdown.hasData)
        assertEquals(0, breakdown.totalGrams)
        assertEquals(0, breakdown.totalMacroCalories)
    }
}
