package com.example.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.data.ProgressDashboardSummary
import com.example.data.ProgressTrendPoint
import com.example.data.WeeklyFrequencyBucket
import com.example.ui.theme.DojoGlassCardFrost
import com.example.ui.theme.DojoGold
import com.example.ui.theme.DojoGoldDark
import com.example.ui.theme.DojoGreen
import com.example.ui.theme.DojoInk
import com.example.ui.theme.DojoLineSoft
import com.example.ui.theme.DojoMuted
import com.example.ui.theme.DojoPurpleBorderGlow
import com.example.ui.theme.DojoPurpleImperial
import com.example.ui.theme.DojoPurpleOrchid
import com.example.ui.theme.DojoPurpleRoyal
import com.example.ui.theme.DojoTextLight
import com.example.ui.theme.VazirmatnFontFamily
import com.example.util.JalaliCalendar
import ir.ehsannarmani.compose_charts.ColumnChart
import ir.ehsannarmani.compose_charts.LineChart
import ir.ehsannarmani.compose_charts.models.AnimationMode
import ir.ehsannarmani.compose_charts.models.BarProperties
import ir.ehsannarmani.compose_charts.models.Bars
import ir.ehsannarmani.compose_charts.models.DotProperties
import ir.ehsannarmani.compose_charts.models.DrawStyle
import ir.ehsannarmani.compose_charts.models.GridProperties
import ir.ehsannarmani.compose_charts.models.HorizontalIndicatorProperties
import ir.ehsannarmani.compose_charts.models.LabelHelperProperties
import ir.ehsannarmani.compose_charts.models.LabelProperties
import ir.ehsannarmani.compose_charts.models.Line
import ir.ehsannarmani.compose_charts.models.PopupProperties
import java.util.Locale
import kotlin.math.roundToInt

private enum class FrequencyChartMode {
    SESSIONS,
    MINUTES
}

@Composable
fun ProgressKpiGrid(
    summary: ProgressDashboardSummary,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .testTag("progress_kpi_grid"),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            ProgressKpiTile(
                label = stringResource(R.string.progress_kpi_workouts),
                value = JalaliCalendar.faNum(summary.totalWorkouts),
                icon = Icons.Default.FitnessCenter,
                accentColor = DojoPurpleRoyal,
                modifier = Modifier.weight(1f)
            )
            ProgressKpiTile(
                label = stringResource(R.string.progress_kpi_milestones),
                value = JalaliCalendar.faNum(summary.totalMilestones),
                icon = Icons.Default.EmojiEvents,
                accentColor = DojoGoldDark,
                modifier = Modifier.weight(1f)
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            ProgressKpiTile(
                label = stringResource(R.string.progress_kpi_minutes),
                value = JalaliCalendar.faNum(summary.totalMinutes),
                icon = Icons.Default.Schedule,
                accentColor = DojoPurpleImperial,
                modifier = Modifier.weight(1f)
            )
            ProgressKpiTile(
                label = stringResource(R.string.progress_kpi_readiness),
                value = "${JalaliCalendar.faNum(summary.averageReadiness)}٪",
                icon = Icons.Default.Speed,
                accentColor = DojoGreen,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun ProgressKpiTile(
    label: String,
    value: String,
    icon: ImageVector,
    accentColor: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        color = DojoGlassCardFrost,
        border = BorderStroke(1.dp, DojoPurpleBorderGlow)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(accentColor.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = accentColor,
                    modifier = Modifier.size(20.dp)
                )
            }
            Column {
                Text(
                    text = value,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.ExtraBold,
                    color = DojoInk
                )
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = DojoMuted
                )
            }
        }
    }
}

@Composable
fun WorkoutFrequencyChartCard(
    buckets: List<WeeklyFrequencyBucket>,
    modifier: Modifier = Modifier
) {
    var mode by remember { mutableStateOf(FrequencyChartMode.SESSIONS) }
    val workoutLabel = stringResource(R.string.progress_cat_workout)
    val milestoneLabel = stringResource(R.string.progress_cat_milestone)
    val minutesUnit = stringResource(R.string.progress_kpi_minutes)

    val barData = remember(buckets, mode, workoutLabel, milestoneLabel, minutesUnit) {
        buckets.map { bucket ->
            if (mode == FrequencyChartMode.SESSIONS) {
                Bars(
                    label = bucket.shortLabel,
                    values = listOf(
                        Bars.Data(
                            label = workoutLabel,
                            value = bucket.workoutCount.toDouble(),
                            color = Brush.verticalGradient(listOf(DojoPurpleOrchid, DojoPurpleRoyal))
                        ),
                        Bars.Data(
                            label = milestoneLabel,
                            value = bucket.milestoneCount.toDouble(),
                            color = Brush.verticalGradient(listOf(DojoGold, DojoGoldDark))
                        )
                    )
                )
            } else {
                Bars(
                    label = bucket.shortLabel,
                    values = listOf(
                        Bars.Data(
                            label = minutesUnit,
                            value = bucket.totalMinutes.toDouble(),
                            color = Brush.verticalGradient(listOf(DojoPurpleOrchid, DojoPurpleImperial))
                        )
                    )
                )
            }
        }
    }

    val maxValue = remember(buckets, mode) {
        if (mode == FrequencyChartMode.SESSIONS) {
            val highest = buckets.maxOfOrNull { maxOf(it.workoutCount, it.milestoneCount) } ?: 1
            maxOf(highest, 3).toDouble() * 1.25
        } else {
            val highest = buckets.maxOfOrNull { it.totalMinutes } ?: 30
            maxOf(highest, 60).toDouble() * 1.15
        }
    }

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .testTag("workout_frequency_chart_card"),
        shape = RoundedCornerShape(24.dp),
        color = DojoGlassCardFrost,
        border = BorderStroke(1.dp, DojoPurpleBorderGlow)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.BarChart,
                    contentDescription = stringResource(R.string.progress_freq_chart_title),
                    tint = DojoPurpleRoyal
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.progress_freq_chart_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = DojoInk
                    )
                    Text(
                        text = stringResource(R.string.progress_freq_chart_subtitle),
                        style = MaterialTheme.typography.bodySmall,
                        color = DojoMuted
                    )
                }
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                FilterChip(
                    selected = mode == FrequencyChartMode.SESSIONS,
                    onClick = { mode = FrequencyChartMode.SESSIONS },
                    modifier = Modifier.testTag("freq_mode_sessions_chip"),
                    label = { Text(stringResource(R.string.progress_freq_mode_sessions)) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = DojoPurpleRoyal,
                        selectedLabelColor = Color.White,
                        containerColor = Color.White.copy(alpha = 0.65f),
                        labelColor = DojoInk
                    )
                )
                FilterChip(
                    selected = mode == FrequencyChartMode.MINUTES,
                    onClick = { mode = FrequencyChartMode.MINUTES },
                    modifier = Modifier.testTag("freq_mode_minutes_chip"),
                    label = { Text(stringResource(R.string.progress_freq_mode_minutes)) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = DojoPurpleRoyal,
                        selectedLabelColor = Color.White,
                        containerColor = Color.White.copy(alpha = 0.65f),
                        labelColor = DojoInk
                    )
                )
            }

            if (mode == FrequencyChartMode.SESSIONS) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    LegendDotItem(label = workoutLabel, color = DojoPurpleRoyal)
                    LegendDotItem(label = milestoneLabel, color = DojoGoldDark)
                }
            }

            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                ColumnChart(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(210.dp)
                        .padding(top = 6.dp)
                        .testTag("workout_frequency_column_chart"),
                    data = barData,
                    maxValue = maxValue,
                    minValue = 0.0,
                    barProperties = BarProperties(
                        thickness = if (mode == FrequencyChartMode.SESSIONS) 12.dp else 18.dp,
                        spacing = 4.dp,
                        cornerRadius = Bars.Data.Radius.Rectangle(topLeft = 6.dp, topRight = 6.dp)
                    ),
                    animationMode = AnimationMode.Together(delayBuilder = { it * 60L }),
                    labelHelperProperties = LabelHelperProperties(enabled = false),
                    labelProperties = LabelProperties(
                        enabled = true,
                        textStyle = TextStyle(
                            fontFamily = VazirmatnFontFamily,
                            fontSize = 10.sp,
                            color = DojoInk
                        )
                    ),
                    indicatorProperties = HorizontalIndicatorProperties(
                        enabled = true,
                        textStyle = TextStyle(
                            fontFamily = VazirmatnFontFamily,
                            fontSize = 10.sp,
                            color = DojoMuted
                        ),
                        contentBuilder = { v -> JalaliCalendar.faNum(v.roundToInt()) }
                    ),
                    gridProperties = GridProperties(
                        enabled = true,
                        xAxisProperties = GridProperties.AxisProperties(
                            enabled = true,
                            color = SolidColor(DojoLineSoft)
                        ),
                        yAxisProperties = GridProperties.AxisProperties(enabled = false)
                    ),
                    popupProperties = PopupProperties(
                        enabled = true,
                        containerColor = DojoInk,
                        textStyle = TextStyle(
                            fontFamily = VazirmatnFontFamily,
                            fontSize = 11.sp,
                            color = Color.White
                        ),
                        contentBuilder = { popup ->
                            val week = buckets.getOrNull(popup.dataIndex)
                            val weekTitle = week?.rangeLabel.orEmpty()
                            val valText = JalaliCalendar.faNum(popup.value.roundToInt())
                            if (mode == FrequencyChartMode.SESSIONS) {
                                val typeLabel = if (popup.valueIndex == 0) workoutLabel else milestoneLabel
                                "$weekTitle • $typeLabel: $valText"
                            } else {
                                "$weekTitle • $valText $minutesUnit"
                            }
                        }
                    )
                )
            }
        }
    }
}

@Composable
fun FitnessMilestonesLineChartCard(
    points: List<ProgressTrendPoint>,
    latestWeightKg: Double?,
    modifier: Modifier = Modifier
) {
    val readinessLabel = stringResource(R.string.progress_kpi_readiness)

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .testTag("milestones_trend_chart_card"),
        shape = RoundedCornerShape(24.dp),
        color = DojoGlassCardFrost,
        border = BorderStroke(1.dp, DojoPurpleBorderGlow)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ShowChart,
                        contentDescription = stringResource(R.string.progress_trend_chart_title),
                        tint = DojoPurpleRoyal
                    )
                    Column {
                        Text(
                            text = stringResource(R.string.progress_trend_chart_title),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = DojoInk
                        )
                        Text(
                            text = stringResource(R.string.progress_trend_chart_subtitle),
                            style = MaterialTheme.typography.bodySmall,
                            color = DojoMuted
                        )
                    }
                }
                if (latestWeightKg != null) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = DojoGold.copy(alpha = 0.18f),
                        border = BorderStroke(1.dp, DojoGold.copy(alpha = 0.45f))
                    ) {
                        Text(
                            text = "${JalaliCalendar.faNum(String.format(Locale.US, "%.1f", latestWeightKg))} kg",
                            style = MaterialTheme.typography.labelMedium,
                            color = DojoInk,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                        )
                    }
                }
            }

            if (points.size < 2) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color.White.copy(alpha = 0.65f),
                    border = BorderStroke(1.dp, DojoLineSoft)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        points.firstOrNull()?.let { first ->
                            Text(
                                text = "${first.title} — ${JalaliCalendar.faNum(first.readinessScore)}/۱۰۰ (${first.fullDateLabel})",
                                style = MaterialTheme.typography.titleSmall,
                                color = DojoPurpleImperial,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            text = stringResource(R.string.progress_trend_single_point_hint),
                            style = MaterialTheme.typography.bodySmall,
                            color = DojoTextLight
                        )
                    }
                }
                return@Column
            }

            val lineSeries = remember(points, readinessLabel) {
                listOf(
                    Line(
                        label = readinessLabel,
                        values = points.map { it.readinessScore.toDouble() },
                        color = Brush.horizontalGradient(listOf(DojoPurpleImperial, DojoPurpleRoyal, DojoPurpleOrchid)),
                        firstGradientFillColor = DojoPurpleOrchid.copy(alpha = 0.34f),
                        secondGradientFillColor = Color.Transparent,
                        drawStyle = DrawStyle.Stroke(width = 3.dp),
                        curvedEdges = true,
                        dotProperties = DotProperties(
                            enabled = true,
                            radius = 5.dp,
                            color = SolidColor(Color.White),
                            strokeWidth = 2.5.dp,
                            strokeColor = SolidColor(DojoPurpleRoyal)
                        )
                    )
                )
            }

            val xLabels = remember(points) {
                points.mapIndexed { idx, p ->
                    if (points.size <= 6 || idx == 0 || idx == points.lastIndex || idx % 2 == 0) {
                        p.shortDateLabel
                    } else {
                        ""
                    }
                }
            }

            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                LineChart(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                        .padding(top = 8.dp)
                        .testTag("milestones_line_chart"),
                    data = lineSeries,
                    curvedEdges = true,
                    animationMode = AnimationMode.Together(delayBuilder = { it * 150L }),
                    maxValue = 105.0,
                    minValue = 0.0,
                    labelHelperProperties = LabelHelperProperties(enabled = false),
                    labelProperties = LabelProperties(
                        enabled = true,
                        labels = xLabels,
                        textStyle = TextStyle(
                            fontFamily = VazirmatnFontFamily,
                            fontSize = 10.sp,
                            color = DojoInk
                        )
                    ),
                    indicatorProperties = HorizontalIndicatorProperties(
                        enabled = true,
                        textStyle = TextStyle(
                            fontFamily = VazirmatnFontFamily,
                            fontSize = 10.sp,
                            color = DojoMuted
                        ),
                        contentBuilder = { v -> JalaliCalendar.faNum(v.roundToInt()) }
                    ),
                    gridProperties = GridProperties(
                        enabled = true,
                        xAxisProperties = GridProperties.AxisProperties(
                            enabled = true,
                            color = SolidColor(DojoLineSoft)
                        ),
                        yAxisProperties = GridProperties.AxisProperties(enabled = false)
                    ),
                    popupProperties = PopupProperties(
                        enabled = true,
                        containerColor = DojoInk,
                        textStyle = TextStyle(
                            fontFamily = VazirmatnFontFamily,
                            fontSize = 11.sp,
                            color = Color.White
                        ),
                        contentBuilder = { popup ->
                            val pt = points.getOrNull(popup.dataIndex)
                            if (pt != null) {
                                "${pt.title} • ${JalaliCalendar.faNum(pt.readinessScore)}/۱۰۰ (${pt.shortDateLabel})"
                            } else {
                                "${JalaliCalendar.faNum(popup.value.roundToInt())}/۱۰۰"
                            }
                        }
                    )
                )
            }
        }
    }
}

@Composable
private fun LegendDotItem(label: String, color: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Box(
            modifier = Modifier
                .size(9.dp)
                .clip(CircleShape)
                .background(color)
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = DojoTextLight
        )
    }
}
