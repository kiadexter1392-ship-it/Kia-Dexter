package com.example.data

import com.example.util.JalaliCalendar
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone
import kotlin.math.roundToInt

data class WeeklyFrequencyBucket(
    val shortLabel: String,
    val rangeLabel: String,
    val workoutCount: Int,
    val milestoneCount: Int,
    val totalMinutes: Int
) {
    val totalEntries: Int
        get() = workoutCount + milestoneCount
}

data class ProgressTrendPoint(
    val shortDateLabel: String,
    val fullDateLabel: String,
    val title: String,
    val category: ProgressLogCategory,
    val readinessScore: Int,
    val durationMinutes: Int,
    val weightKg: Double?
)

data class ProgressDashboardSummary(
    val hasAnyLogs: Boolean,
    val totalWorkouts: Int,
    val totalMilestones: Int,
    val totalMinutes: Int,
    val averageReadiness: Int,
    val thisWeekSessions: Int,
    val latestWeightKg: Double?,
    val weeklyBuckets: List<WeeklyFrequencyBucket>,
    val trendPoints: List<ProgressTrendPoint>
)

object ProgressAnalytics {
    private const val MILLIS_PER_DAY = 86_400_000L
    private const val WEEK_BUCKETS = 6

    fun compute(
        logs: List<WorkoutProgressLogDoc>,
        referenceDateIso: String = JalaliCalendar.todayDateIso()
    ): ProgressDashboardSummary {
        if (logs.isEmpty()) {
            return ProgressDashboardSummary(
                hasAnyLogs = false,
                totalWorkouts = 0,
                totalMilestones = 0,
                totalMinutes = 0,
                averageReadiness = 0,
                thisWeekSessions = 0,
                latestWeightKg = null,
                weeklyBuckets = emptyList(),
                trendPoints = emptyList()
            )
        }

        val sortedChronological = logs.sortedWith(
            compareBy<WorkoutProgressLogDoc>(
                { effectiveDateIso(it, referenceDateIso) },
                { it.createdAt?.toDate()?.time ?: 0L },
                { it.id }
            )
        )

        val totalWorkouts = sortedChronological.count {
            it.resolvedCategory() == ProgressLogCategory.WORKOUT
        }
        val totalMilestones = sortedChronological.count {
            it.resolvedCategory() == ProgressLogCategory.MILESTONE
        }
        val totalMinutes = sortedChronological.sumOf {
            it.durationMinutes.coerceIn(0L, 600L).toInt()
        }
        val averageReadiness = sortedChronological
            .map { it.readinessScore.coerceIn(1L, 100L).toDouble() }
            .average()
            .roundToInt()

        val latestWeightKg = sortedChronological
            .lastOrNull { it.weightKgOrNull() != null }
            ?.weightKgOrNull()

        val refDayMillis = parseDayStartMillis(referenceDateIso) ?: currentDayStartMillis()
        val latestLogMillis = sortedChronological
            .mapNotNull { parseDayStartMillis(effectiveDateIso(it, referenceDateIso)) }
            .maxOrNull() ?: refDayMillis
        val anchorEndMillis = maxOf(refDayMillis, latestLogMillis)

        // Align anchor end to 7-day rolling buckets ending on anchorEndMillis
        val buckets = (WEEK_BUCKETS - 1 downTo 0).map { weeksAgo ->
            val endMillis = anchorEndMillis - (weeksAgo * 7L * MILLIS_PER_DAY)
            val startMillis = endMillis - (6L * MILLIS_PER_DAY)
            val startJalali = JalaliCalendar.toJalali(startMillis + 12L * 3_600_000L)
            val endJalali = JalaliCalendar.toJalali(endMillis + 12L * 3_600_000L)

            val shortLabel = JalaliCalendar.faNum(
                "${startJalali.jd} ${JalaliCalendar.MONTHS_SHORT[startJalali.jm - 1]}"
            )
            val rangeLabel = "${JalaliCalendar.faNum(startJalali.jd)} تا " +
                "${JalaliCalendar.faNum(endJalali.jd)} ${JalaliCalendar.MONTHS[endJalali.jm - 1]}"

            val inBucket = sortedChronological.filter { doc ->
                val dayMs = parseDayStartMillis(effectiveDateIso(doc, referenceDateIso)) ?: refDayMillis
                dayMs in startMillis..endMillis
            }

            WeeklyFrequencyBucket(
                shortLabel = shortLabel,
                rangeLabel = rangeLabel,
                workoutCount = inBucket.count { it.resolvedCategory() == ProgressLogCategory.WORKOUT },
                milestoneCount = inBucket.count { it.resolvedCategory() == ProgressLogCategory.MILESTONE },
                totalMinutes = inBucket.sumOf { it.durationMinutes.coerceIn(0L, 600L).toInt() }
            )
        }

        val thisWeekSessions = buckets.lastOrNull()?.totalEntries ?: 0

        val trendPoints = sortedChronological.takeLast(12).map { doc ->
            val iso = effectiveDateIso(doc, referenceDateIso)
            val jalali = JalaliCalendar.toJalaliFromIso(iso)
            val shortDateLabel = if (jalali != null) {
                JalaliCalendar.faNum("${jalali.jd}/${jalali.jm}")
            } else {
                "—"
            }
            val fullDateLabel = if (jalali != null) {
                JalaliCalendar.formatJalaliNamed(jalali)
            } else {
                "—"
            }
            ProgressTrendPoint(
                shortDateLabel = shortDateLabel,
                fullDateLabel = fullDateLabel,
                title = doc.title.ifBlank { "تمرین" },
                category = doc.resolvedCategory(),
                readinessScore = doc.readinessScore.coerceIn(1L, 100L).toInt(),
                durationMinutes = doc.durationMinutes.coerceIn(0L, 600L).toInt(),
                weightKg = doc.weightKgOrNull()
            )
        }

        return ProgressDashboardSummary(
            hasAnyLogs = true,
            totalWorkouts = totalWorkouts,
            totalMilestones = totalMilestones,
            totalMinutes = totalMinutes,
            averageReadiness = averageReadiness,
            thisWeekSessions = thisWeekSessions,
            latestWeightKg = latestWeightKg,
            weeklyBuckets = buckets,
            trendPoints = trendPoints
        )
    }

    private fun effectiveDateIso(doc: WorkoutProgressLogDoc, fallbackIso: String): String {
        val raw = doc.sessionDateIso.trim()
        if (Regex("""^\d{4}-\d{2}-\d{2}$""").matches(raw)) {
            return raw
        }
        val tsMillis = doc.createdAt?.toDate()?.time
        if (tsMillis != null) {
            val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
                timeInMillis = tsMillis
            }
            return String.format(
                Locale.US,
                "%04d-%02d-%02d",
                cal.get(Calendar.YEAR),
                cal.get(Calendar.MONTH) + 1,
                cal.get(Calendar.DAY_OF_MONTH)
            )
        }
        return fallbackIso
    }

    private fun parseDayStartMillis(iso: String): Long? {
        val parts = iso.trim().split("-")
        if (parts.size != 3) return null
        val y = parts[0].toIntOrNull() ?: return null
        val m = parts[1].toIntOrNull() ?: return null
        val d = parts[2].toIntOrNull() ?: return null
        return Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
            set(y, m - 1, d, 0, 0, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }

    private fun currentDayStartMillis(): Long {
        val now = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        return Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
            set(
                now.get(Calendar.YEAR),
                now.get(Calendar.MONTH),
                now.get(Calendar.DAY_OF_MONTH),
                0,
                0,
                0
            )
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }
}
