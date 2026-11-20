package com.example.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ProgressAnalyticsTest {

    @Test
    fun compute_emptyLogs_returnsEmptySummaryWithoutFakeData() {
        val summary = ProgressAnalytics.compute(emptyList(), referenceDateIso = "2026-11-19")
        assertFalse(summary.hasAnyLogs)
        assertEquals(0, summary.totalWorkouts)
        assertEquals(0, summary.totalMilestones)
        assertEquals(0, summary.totalMinutes)
        assertEquals(0, summary.averageReadiness)
        assertNull(summary.latestWeightKg)
        assertTrue(summary.weeklyBuckets.isEmpty())
        assertTrue(summary.trendPoints.isEmpty())
    }

    @Test
    fun compute_aggregatesWorkoutsMilestonesAndWeeklyFrequency() {
        val logs = listOf(
            WorkoutProgressLogDoc(
                id = "3",
                userId = "u1",
                category = "MILESTONE",
                title = "کمربند سبز",
                durationMinutes = 0,
                readinessScore = 94,
                weightTenthsKg = 725,
                sessionDateIso = "2026-11-19"
            ),
            WorkoutProgressLogDoc(
                id = "1",
                userId = "u1",
                category = "WORKOUT",
                title = "کاتا و سرعت",
                durationMinutes = 60,
                readinessScore = 76,
                weightTenthsKg = 740,
                sessionDateIso = "2026-11-05"
            ),
            WorkoutProgressLogDoc(
                id = "2",
                userId = "u1",
                category = "WORKOUT",
                title = "تمرین قدرتی",
                durationMinutes = 45,
                readinessScore = 82,
                weightTenthsKg = 0,
                sessionDateIso = "2026-11-17"
            )
        )

        val summary = ProgressAnalytics.compute(logs, referenceDateIso = "2026-11-19")

        assertTrue(summary.hasAnyLogs)
        assertEquals(2, summary.totalWorkouts)
        assertEquals(1, summary.totalMilestones)
        assertEquals(105, summary.totalMinutes)
        assertEquals(84, summary.averageReadiness)
        assertEquals(72.5, summary.latestWeightKg ?: 0.0, 0.01)
        assertEquals(2, summary.thisWeekSessions)
        assertEquals(6, summary.weeklyBuckets.size)
        assertEquals(2, summary.weeklyBuckets.last().totalEntries)
        assertEquals(1, summary.weeklyBuckets.last().workoutCount)
        assertEquals(1, summary.weeklyBuckets.last().milestoneCount)
        assertEquals(45, summary.weeklyBuckets.last().totalMinutes)

        // Chronologically ordered oldest -> newest
        assertEquals(listOf("کاتا و سرعت", "تمرین قدرتی", "کمربند سبز"), summary.trendPoints.map { it.title })
        assertEquals(listOf(76, 82, 94), summary.trendPoints.map { it.readinessScore })
    }
}
