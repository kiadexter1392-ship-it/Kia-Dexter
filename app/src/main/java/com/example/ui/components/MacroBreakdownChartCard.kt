package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.PieChart
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ai.MacroBreakdownSummary
import com.example.ai.MacroSliceStats
import com.example.ai.MacroType
import com.example.ai.MealItem
import com.example.ai.MealPlanResult
import com.example.ui.theme.DojoGlassCardFrost
import com.example.ui.theme.DojoInk
import com.example.ui.theme.DojoLineSoft
import com.example.ui.theme.DojoMuted
import com.example.ui.theme.DojoPurpleBorderGlow
import com.example.ui.theme.DojoPurpleImperial
import com.example.ui.theme.DojoPurpleRoyal
import com.example.ui.theme.DojoTextLight
import com.example.ui.theme.MacroCarbsColor
import com.example.ui.theme.MacroCarbsGlow
import com.example.ui.theme.MacroFatColor
import com.example.ui.theme.MacroFatGlow
import com.example.ui.theme.MacroProteinColor
import com.example.ui.theme.MacroProteinGlow
import com.example.ui.theme.VazirmatnFontFamily
import ir.ehsannarmani.compose_charts.ColumnChart
import ir.ehsannarmani.compose_charts.PieChart
import ir.ehsannarmani.compose_charts.models.BarProperties
import ir.ehsannarmani.compose_charts.models.Bars
import ir.ehsannarmani.compose_charts.models.GridProperties
import ir.ehsannarmani.compose_charts.models.HorizontalIndicatorProperties
import ir.ehsannarmani.compose_charts.models.LabelHelperProperties
import ir.ehsannarmani.compose_charts.models.LabelProperties
import ir.ehsannarmani.compose_charts.models.Pie
import ir.ehsannarmani.compose_charts.models.PopupProperties
import kotlin.math.roundToInt

private enum class MacroChartMode {
    CALORIES,
    GRAMS
}

@Composable
fun MacroBreakdownChartCard(
    plan: MealPlanResult,
    modifier: Modifier = Modifier
) {
    val breakdown = remember(plan) { plan.macroBreakdown() }
    var chartMode by remember(plan) { mutableStateOf(MacroChartMode.CALORIES) }
    var selectedMacro by remember(plan) { mutableStateOf<MacroType?>(null) }

    val proteinLabel = stringResource(R.string.macro_chart_protein)
    val carbsLabel = stringResource(R.string.macro_chart_carbs)
    val fatsLabel = stringResource(R.string.macro_chart_fats)
    val gramUnit = stringResource(R.string.macro_chart_gram_unit)
    val kcalUnit = stringResource(R.string.macro_chart_kcal_unit)

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .testTag("macro_chart_card"),
        shape = RoundedCornerShape(24.dp),
        color = DojoGlassCardFrost,
        border = BorderStroke(1.dp, DojoPurpleBorderGlow)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.PieChart,
                    contentDescription = stringResource(R.string.macro_chart_title),
                    tint = DojoPurpleRoyal
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.macro_chart_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = DojoInk
                    )
                    Text(
                        text = stringResource(R.string.macro_chart_subtitle),
                        style = MaterialTheme.typography.bodySmall,
                        color = DojoMuted
                    )
                }
            }

            if (!breakdown.hasData) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.BarChart,
                        contentDescription = null,
                        tint = DojoMuted,
                        modifier = Modifier.size(32.dp)
                    )
                    Text(
                        text = stringResource(R.string.macro_chart_empty_msg),
                        style = MaterialTheme.typography.bodySmall,
                        color = DojoMuted,
                        textAlign = TextAlign.Center
                    )
                }
                return@Column
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                FilterChip(
                    selected = chartMode == MacroChartMode.CALORIES,
                    onClick = { chartMode = MacroChartMode.CALORIES },
                    modifier = Modifier.testTag("macro_mode_calories_chip"),
                    label = { Text(stringResource(R.string.macro_chart_mode_calories)) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = DojoPurpleRoyal,
                        selectedLabelColor = Color.White,
                        containerColor = Color.White.copy(alpha = 0.65f),
                        labelColor = DojoInk
                    )
                )
                FilterChip(
                    selected = chartMode == MacroChartMode.GRAMS,
                    onClick = { chartMode = MacroChartMode.GRAMS },
                    modifier = Modifier.testTag("macro_mode_grams_chip"),
                    label = { Text(stringResource(R.string.macro_chart_mode_grams)) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = DojoPurpleRoyal,
                        selectedLabelColor = Color.White,
                        containerColor = Color.White.copy(alpha = 0.65f),
                        labelColor = DojoInk
                    )
                )
            }

            MacroDonutSection(
                breakdown = breakdown,
                chartMode = chartMode,
                selectedMacro = selectedMacro,
                proteinLabel = proteinLabel,
                carbsLabel = carbsLabel,
                fatsLabel = fatsLabel,
                gramUnit = gramUnit,
                kcalUnit = kcalUnit,
                onSelectMacro = { clicked ->
                    selectedMacro = if (selectedMacro == clicked) null else clicked
                }
            )

            val activeSlice = breakdown.slices.firstOrNull { it.type == selectedMacro }
            AnimatedVisibility(
                visible = activeSlice != null,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                activeSlice?.let { slice ->
                    val label = macroLabel(slice.type, proteinLabel, carbsLabel, fatsLabel)
                    val color = macroPrimaryColor(slice.type)
                    val pct = if (chartMode == MacroChartMode.CALORIES) {
                        slice.caloriePercent
                    } else {
                        slice.gramPercent
                    }.roundToInt()

                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("macro_selected_tooltip"),
                        shape = RoundedCornerShape(14.dp),
                        color = color.copy(alpha = 0.12f),
                        border = BorderStroke(1.dp, color.copy(alpha = 0.35f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(10.dp)
                                        .clip(CircleShape)
                                        .background(color)
                                )
                                Text(
                                    text = label,
                                    style = MaterialTheme.typography.titleSmall,
                                    color = color,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Text(
                                text = "${slice.grams} $gramUnit • ${slice.calories} $kcalUnit ($pct٪)",
                                style = MaterialTheme.typography.labelLarge,
                                color = DojoInk
                            )
                        }
                    }
                }
            }

            if (activeSlice == null) {
                Text(
                    text = stringResource(R.string.macro_chart_tap_hint),
                    style = MaterialTheme.typography.labelSmall,
                    color = DojoMuted
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                breakdown.slices.forEach { slice ->
                    val label = macroLabel(slice.type, proteinLabel, carbsLabel, fatsLabel)
                    val color = macroPrimaryColor(slice.type)
                    val pct = if (chartMode == MacroChartMode.CALORIES) {
                        slice.caloriePercent
                    } else {
                        slice.gramPercent
                    }
                    MacroLegendRow(
                        label = label,
                        slice = slice,
                        percent = pct,
                        color = color,
                        gramUnit = gramUnit,
                        kcalUnit = kcalUnit,
                        selected = selectedMacro == slice.type,
                        testTag = when (slice.type) {
                            MacroType.PROTEIN -> "macro_legend_protein"
                            MacroType.CARBS -> "macro_legend_carbs"
                            MacroType.FATS -> "macro_legend_fats"
                        },
                        onClick = {
                            selectedMacro = if (selectedMacro == slice.type) null else slice.type
                        }
                    )
                }
            }

            if (breakdown.hasPerMealMacros && plan.meals.isNotEmpty()) {
                HorizontalDivider(color = DojoLineSoft)
                PerMealMacroColumnSection(
                    meals = plan.meals,
                    proteinLabel = proteinLabel,
                    carbsLabel = carbsLabel,
                    fatsLabel = fatsLabel
                )
            }
        }
    }
}

@Composable
private fun MacroDonutSection(
    breakdown: MacroBreakdownSummary,
    chartMode: MacroChartMode,
    selectedMacro: MacroType?,
    proteinLabel: String,
    carbsLabel: String,
    fatsLabel: String,
    gramUnit: String,
    kcalUnit: String,
    onSelectMacro: (MacroType) -> Unit
) {
    val pieEntries = remember(breakdown, chartMode, selectedMacro, proteinLabel, carbsLabel, fatsLabel) {
        breakdown.slices
            .filter { it.grams > 0 }
            .map { slice ->
                val value = if (chartMode == MacroChartMode.CALORIES) {
                    slice.calories.toDouble()
                } else {
                    slice.grams.toDouble()
                }
                Pie(
                    label = macroLabel(slice.type, proteinLabel, carbsLabel, fatsLabel),
                    data = value,
                    color = macroPrimaryColor(slice.type),
                    selectedColor = macroGlowColor(slice.type),
                    selected = selectedMacro == slice.type
                )
            }
    }

    val chartContentDesc = "${stringResource(R.string.macro_chart_title)}: " +
        "$proteinLabel ${breakdown.protein.grams} $gramUnit, " +
        "$carbsLabel ${breakdown.carbs.grams} $gramUnit, " +
        "$fatsLabel ${breakdown.fats.grams} $gramUnit"

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(210.dp)
            .semantics { contentDescription = chartContentDesc },
        contentAlignment = Alignment.Center
    ) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            PieChart(
                modifier = Modifier
                    .size(196.dp)
                    .testTag("macro_pie_chart"),
                data = pieEntries,
                style = Pie.Style.Stroke(width = 26.dp),
                spaceDegree = 4f,
                selectedScale = 1.07f,
                onPieClick = { clickedPie ->
                    val clickedType = when (clickedPie.label) {
                        proteinLabel -> MacroType.PROTEIN
                        carbsLabel -> MacroType.CARBS
                        fatsLabel -> MacroType.FATS
                        else -> null
                    }
                    if (clickedType != null) {
                        onSelectMacro(clickedType)
                    }
                }
            )
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = if (chartMode == MacroChartMode.CALORIES) {
                    "${breakdown.totalMacroCalories}"
                } else {
                    "${breakdown.totalGrams}"
                },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.ExtraBold,
                color = DojoInk
            )
            Text(
                text = if (chartMode == MacroChartMode.CALORIES) kcalUnit else gramUnit,
                style = MaterialTheme.typography.labelSmall,
                color = DojoMuted
            )
        }
    }
}

@Composable
private fun MacroLegendRow(
    label: String,
    slice: MacroSliceStats,
    percent: Float,
    color: Color,
    gramUnit: String,
    kcalUnit: String,
    selected: Boolean,
    testTag: String,
    onClick: () -> Unit
) {
    val pctRounded = percent.roundToInt()
    val fraction = (percent / 100f).coerceIn(0f, 1f)

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .testTag(testTag),
        shape = RoundedCornerShape(14.dp),
        color = if (selected) color.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.55f),
        border = BorderStroke(
            width = if (selected) 1.5.dp else 1.dp,
            color = if (selected) color.copy(alpha = 0.5f) else DojoLineSoft
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(color)
                    )
                    Text(
                        text = label,
                        style = MaterialTheme.typography.titleSmall,
                        color = DojoInk
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "${slice.grams} $gramUnit (${slice.calories} $kcalUnit)",
                        style = MaterialTheme.typography.bodySmall,
                        color = DojoTextLight
                    )
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = color.copy(alpha = 0.16f)
                    ) {
                        Text(
                            text = "$pctRounded٪",
                            style = MaterialTheme.typography.labelMedium,
                            color = color,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(color.copy(alpha = 0.14f))
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(fraction = fraction)
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(
                            Brush.horizontalGradient(
                                colors = listOf(color, color.copy(alpha = 0.78f))
                            )
                        )
                )
            }
        }
    }
}

@Composable
private fun PerMealMacroColumnSection(
    meals: List<MealItem>,
    proteinLabel: String,
    carbsLabel: String,
    fatsLabel: String
) {
    val barData = remember(meals, proteinLabel, carbsLabel, fatsLabel) {
        meals.mapIndexed { index, meal ->
            val shortLabel = meal.mealTitle
                .trim()
                .takeIf { it.isNotEmpty() }
                ?.let { if (it.length > 9) "${it.take(8)}…" else it }
                ?: "وعده ${index + 1}"

            Bars(
                label = shortLabel,
                values = listOf(
                    Bars.Data(
                        label = proteinLabel,
                        value = meal.proteinGrams.coerceAtLeast(0).toDouble(),
                        color = SolidColor(MacroProteinColor)
                    ),
                    Bars.Data(
                        label = carbsLabel,
                        value = meal.carbsGrams.coerceAtLeast(0).toDouble(),
                        color = SolidColor(MacroCarbsColor)
                    ),
                    Bars.Data(
                        label = fatsLabel,
                        value = meal.fatGrams.coerceAtLeast(0).toDouble(),
                        color = SolidColor(MacroFatColor)
                    )
                )
            )
        }
    }

    val maxGrams = remember(meals) {
        meals.maxOfOrNull { maxOf(it.proteinGrams, it.carbsGrams, it.fatGrams) }
            ?.coerceAtLeast(20)
            ?.toDouble()
            ?: 100.0
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = Icons.Default.BarChart,
                contentDescription = stringResource(R.string.macro_chart_per_meal_title),
                tint = DojoPurpleImperial,
                modifier = Modifier.size(20.dp)
            )
            Text(
                text = stringResource(R.string.macro_chart_per_meal_title),
                style = MaterialTheme.typography.titleSmall,
                color = DojoInk
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CompactColorLegend(label = proteinLabel, color = MacroProteinColor)
            CompactColorLegend(label = carbsLabel, color = MacroCarbsColor)
            CompactColorLegend(label = fatsLabel, color = MacroFatColor)
        }

        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            ColumnChart(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(210.dp)
                    .padding(top = 6.dp)
                    .testTag("macro_column_chart"),
                data = barData,
                maxValue = maxGrams * 1.15,
                minValue = 0.0,
                barProperties = BarProperties(
                    thickness = if (meals.size <= 4) 11.dp else 8.dp,
                    spacing = 3.dp,
                    cornerRadius = Bars.Data.Radius.Rectangle(topLeft = 5.dp, topRight = 5.dp)
                ),
                labelHelperProperties = LabelHelperProperties(enabled = false),
                labelProperties = LabelProperties(
                    enabled = true,
                    textStyle = TextStyle(
                        fontFamily = VazirmatnFontFamily,
                        fontSize = 11.sp,
                        color = DojoInk
                    )
                ),
                indicatorProperties = HorizontalIndicatorProperties(
                    enabled = true,
                    textStyle = TextStyle(
                        fontFamily = VazirmatnFontFamily,
                        fontSize = 10.sp,
                        color = DojoMuted
                    )
                ),
                gridProperties = GridProperties(
                    enabled = true,
                    xAxisProperties = GridProperties.AxisProperties(
                        enabled = true,
                        color = SolidColor(DojoLineSoft)
                    ),
                    yAxisProperties = GridProperties.AxisProperties(
                        enabled = false
                    )
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
                        val macroName = when (popup.valueIndex) {
                            0 -> proteinLabel
                            1 -> carbsLabel
                            else -> fatsLabel
                        }
                        val mealName = meals.getOrNull(popup.dataIndex)?.mealTitle.orEmpty()
                        "$mealName • $macroName: ${popup.value.roundToInt()}g"
                    }
                )
            )
        }
    }
}

@Composable
private fun CompactColorLegend(label: String, color: Color) {
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

private fun macroLabel(
    type: MacroType,
    proteinLabel: String,
    carbsLabel: String,
    fatsLabel: String
): String = when (type) {
    MacroType.PROTEIN -> proteinLabel
    MacroType.CARBS -> carbsLabel
    MacroType.FATS -> fatsLabel
}

private fun macroPrimaryColor(type: MacroType): Color = when (type) {
    MacroType.PROTEIN -> MacroProteinColor
    MacroType.CARBS -> MacroCarbsColor
    MacroType.FATS -> MacroFatColor
}

private fun macroGlowColor(type: MacroType): Color = when (type) {
    MacroType.PROTEIN -> MacroProteinGlow
    MacroType.CARBS -> MacroCarbsGlow
    MacroType.FATS -> MacroFatGlow
}
