package com.example.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.LocalDrink
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.RestaurantMenu
import androidx.compose.material.icons.filled.TipsAndUpdates
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.R
import com.example.ai.CloudProfileUiState
import com.example.ai.GeminiUiViewModel
import com.example.ai.MealItem
import com.example.ai.MealPlanRequest
import com.example.ai.MealPlanResult
import com.example.ai.MealPlanUiState
import com.example.ui.components.CloudAccountStatusCard
import com.example.ui.components.MacroBreakdownChartCard
import com.example.ui.components.SavedMealPlansHistoryCard
import com.example.ui.theme.DojoGlassCardFrost
import com.example.ui.theme.DojoGold
import com.example.ui.theme.DojoGoldDark
import com.example.ui.theme.DojoInk
import com.example.ui.theme.DojoMuted
import com.example.ui.theme.DojoPurpleBorderGlow
import com.example.ui.theme.DojoPurpleImperial
import com.example.ui.theme.DojoPurpleRoyal
import com.example.ui.theme.DojoRed
import com.example.ui.theme.DojoTextLight
import androidx.compose.runtime.LaunchedEffect

private val DIET_GOALS = listOf(
    "کاهش وزن و چربی‌سوزی",
    "افزایش حجم و عضله‌سازی",
    "آمادگی رزمی و افزایش انرژی",
    "تغذیه سالم و حفظ وزن"
)

private val QUICK_PRESETS = listOf(
    "اقتصادی و با غذاهای خانگی",
    "پرپروتئین و کم‌چرب",
    "سریع‌الپخت و دانشجویی",
    "بدون قند مصنوعی"
)

private val MEAL_COUNTS = listOf(3, 4, 5, 6)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MealPlanScreen(
    viewModel: GeminiUiViewModel,
    userDisplayName: String,
    userEmail: String,
    onSignOut: () -> Unit,
    onBack: () -> Unit,
    onShowMessage: (String) -> Unit
) {
    val context = LocalContext.current
    val mealPlanState by viewModel.mealPlanState.collectAsStateWithLifecycle()
    val userProfileState by viewModel.userProfileState.collectAsStateWithLifecycle()
    val savedPlansState by viewModel.savedPlansState.collectAsStateWithLifecycle()

    var selectedGoal by rememberSaveable { mutableStateOf(DIET_GOALS.first()) }
    var mealCount by rememberSaveable { mutableIntStateOf(4) }
    var bodyStats by rememberSaveable { mutableStateOf("") }
    var preferredFoods by rememberSaveable { mutableStateOf("") }
    var restrictions by rememberSaveable { mutableStateOf("") }
    var extraNotes by rememberSaveable { mutableStateOf("") }
    var profileHydrated by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(userProfileState) {
        val loaded = (userProfileState as? CloudProfileUiState.Success)?.profile
        if (loaded != null && !profileHydrated) {
            if (loaded.goal.isNotBlank()) selectedGoal = loaded.goal
            if (loaded.mealCount in 3L..6L) mealCount = loaded.mealCount.toInt()
            if (bodyStats.isBlank() && loaded.bodyStats.isNotBlank()) bodyStats = loaded.bodyStats
            if (preferredFoods.isBlank() && loaded.preferredFoods.isNotBlank()) preferredFoods = loaded.preferredFoods
            if (restrictions.isBlank() && loaded.restrictions.isNotBlank()) restrictions = loaded.restrictions
            if (extraNotes.isBlank() && loaded.extraNotes.isNotBlank()) extraNotes = loaded.extraNotes
            profileHydrated = true
        }
    }

    fun submitPlanRequest() {
        viewModel.generateMealPlan(
            MealPlanRequest(
                goal = selectedGoal,
                mealCount = mealCount,
                bodyStats = bodyStats,
                preferredFoods = preferredFoods,
                restrictions = restrictions,
                extraNotes = extraNotes
            )
        )
    }

    BackHandler(enabled = mealPlanState is MealPlanUiState.Success) {
        viewModel.resetMealPlan()
    }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Box(modifier = Modifier.fillMaxSize()) {
            LuxuryPurpleAmbientBackdrop(modifier = Modifier.fillMaxSize())

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .windowInsetsPadding(WindowInsets.safeDrawing)
                    .imePadding()
            ) {
                Surface(
                    color = DojoGlassCardFrost,
                    border = BorderStroke(1.dp, DojoPurpleBorderGlow)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        IconButton(
                            onClick = {
                                if (mealPlanState is MealPlanUiState.Success) {
                                    viewModel.resetMealPlan()
                                } else {
                                    onBack()
                                }
                            },
                            modifier = Modifier
                                .size(48.dp)
                                .testTag("meal_plan_back_btn")
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "بازگشت",
                                tint = DojoPurpleImperial
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = stringResource(R.string.meal_plan_title),
                                style = MaterialTheme.typography.titleLarge,
                                color = DojoInk,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = stringResource(R.string.meal_plan_subtitle),
                                style = MaterialTheme.typography.bodySmall,
                                color = DojoMuted
                            )
                        }
                        Surface(
                            shape = CircleShape,
                            color = Color.White,
                            border = BorderStroke(1.dp, DojoPurpleBorderGlow),
                            modifier = Modifier.padding(end = 6.dp)
                        ) {
                            Image(
                                painter = painterResource(R.drawable.ic_arsalan_dojo_logo),
                                contentDescription = stringResource(R.string.app_name),
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                            )
                        }
                    }
                }

                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.TopCenter
                ) {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .widthIn(max = 600.dp)
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        item { Spacer(modifier = Modifier.height(6.dp)) }

                        item {
                            CloudAccountStatusCard(
                                displayName = userDisplayName,
                                email = userEmail,
                                onSignOut = onSignOut
                            )
                        }

                        when (val state = mealPlanState) {
                            is MealPlanUiState.Idle,
                            is MealPlanUiState.Error -> {
                                if (state is MealPlanUiState.Error) {
                                    item {
                                        Surface(
                                            shape = RoundedCornerShape(20.dp),
                                            color = DojoGlassCardFrost,
                                            border = BorderStroke(1.dp, DojoRed.copy(alpha = 0.45f))
                                        ) {
                                            Column(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(16.dp),
                                                verticalArrangement = Arrangement.spacedBy(10.dp)
                                            ) {
                                                Text(
                                                    text = state.message,
                                                    style = MaterialTheme.typography.bodyMedium,
                                                    color = DojoRed,
                                                    fontWeight = FontWeight.SemiBold
                                                )
                                                Button(
                                                    onClick = { viewModel.retryLastRequest() },
                                                    modifier = Modifier
                                                        .height(48.dp)
                                                        .testTag("meal_plan_retry_btn"),
                                                    colors = ButtonDefaults.buttonColors(
                                                        containerColor = DojoPurpleRoyal,
                                                        contentColor = Color.White
                                                    )
                                                ) {
                                                    Icon(
                                                        imageVector = Icons.Default.Refresh,
                                                        contentDescription = null,
                                                        modifier = Modifier.size(18.dp)
                                                    )
                                                    Spacer(modifier = Modifier.size(6.dp))
                                                    Text(stringResource(R.string.action_retry))
                                                }
                                            }
                                        }
                                    }
                                }

                                item {
                                    Surface(
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
                                            Text(
                                                text = stringResource(R.string.meal_plan_goal_label),
                                                style = MaterialTheme.typography.titleSmall,
                                                color = DojoInk
                                            )
                                            FlowRow(
                                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                                verticalArrangement = Arrangement.spacedBy(6.dp)
                                            ) {
                                                DIET_GOALS.forEach { goal ->
                                                    val selected = selectedGoal == goal
                                                    FilterChip(
                                                        selected = selected,
                                                        onClick = { selectedGoal = goal },
                                                        label = { Text(goal) },
                                                        colors = FilterChipDefaults.filterChipColors(
                                                            selectedContainerColor = DojoPurpleRoyal,
                                                            selectedLabelColor = Color.White,
                                                            containerColor = Color.White.copy(alpha = 0.65f),
                                                            labelColor = DojoInk
                                                        )
                                                    )
                                                }
                                            }

                                            Text(
                                                text = stringResource(R.string.meal_plan_meals_count_label),
                                                style = MaterialTheme.typography.titleSmall,
                                                color = DojoInk
                                            )
                                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                                MEAL_COUNTS.forEach { count ->
                                                    val selected = mealCount == count
                                                    FilterChip(
                                                        selected = selected,
                                                        onClick = { mealCount = count },
                                                        label = { Text("$count وعده") },
                                                        colors = FilterChipDefaults.filterChipColors(
                                                            selectedContainerColor = DojoPurpleRoyal,
                                                            selectedLabelColor = Color.White,
                                                            containerColor = Color.White.copy(alpha = 0.65f),
                                                            labelColor = DojoInk
                                                        )
                                                    )
                                                }
                                            }

                                            GlassInputField(
                                                value = bodyStats,
                                                onValueChange = { bodyStats = it },
                                                label = stringResource(R.string.meal_plan_stats_label),
                                                placeholder = stringResource(R.string.meal_plan_stats_hint),
                                                testTag = "meal_stats_input"
                                            )

                                            GlassInputField(
                                                value = preferredFoods,
                                                onValueChange = { preferredFoods = it },
                                                label = stringResource(R.string.meal_plan_foods_label),
                                                placeholder = stringResource(R.string.meal_plan_foods_hint),
                                                minLines = 2,
                                                testTag = "meal_foods_input"
                                            )

                                            GlassInputField(
                                                value = restrictions,
                                                onValueChange = { restrictions = it },
                                                label = stringResource(R.string.meal_plan_restrictions_label),
                                                placeholder = stringResource(R.string.meal_plan_restrictions_hint),
                                                testTag = "meal_restrictions_input"
                                            )

                                            GlassInputField(
                                                value = extraNotes,
                                                onValueChange = { extraNotes = it },
                                                label = stringResource(R.string.meal_plan_notes_label),
                                                placeholder = stringResource(R.string.meal_plan_notes_hint),
                                                minLines = 2,
                                                testTag = "meal_notes_input"
                                            )

                                            FlowRow(
                                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                                verticalArrangement = Arrangement.spacedBy(6.dp)
                                            ) {
                                                QUICK_PRESETS.forEach { preset ->
                                                    val added = extraNotes.contains(preset)
                                                    FilterChip(
                                                        selected = added,
                                                        onClick = {
                                                            extraNotes = if (added) {
                                                                extraNotes.replace(preset, "").trim(' ', '،', ',')
                                                            } else if (extraNotes.isBlank()) {
                                                                preset
                                                            } else {
                                                                "${extraNotes.trim()}، $preset"
                                                            }
                                                        },
                                                        label = { Text(preset, style = MaterialTheme.typography.labelMedium) },
                                                        colors = FilterChipDefaults.filterChipColors(
                                                            selectedContainerColor = DojoGold,
                                                            selectedLabelColor = DojoInk,
                                                            containerColor = Color.White.copy(alpha = 0.55f),
                                                            labelColor = DojoTextLight
                                                        )
                                                    )
                                                }
                                            }

                                            Button(
                                                onClick = { submitPlanRequest() },
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .height(52.dp)
                                                    .testTag("generate_meal_plan_btn"),
                                                shape = RoundedCornerShape(16.dp),
                                                colors = ButtonDefaults.buttonColors(
                                                    containerColor = DojoPurpleRoyal,
                                                    contentColor = Color.White
                                                )
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.AutoAwesome,
                                                    contentDescription = null,
                                                    modifier = Modifier.size(20.dp)
                                                )
                                                Spacer(modifier = Modifier.size(8.dp))
                                                Text(
                                                    text = stringResource(R.string.meal_plan_generate_btn),
                                                    style = MaterialTheme.typography.labelLarge
                                                )
                                            }
                                        }
                                    }
                                }

                                item {
                                    SavedMealPlansHistoryCard(
                                        savedPlansState = savedPlansState,
                                        onSelectPlan = { viewModel.selectSavedMealPlan(it) }
                                    )
                                }
                            }

                            is MealPlanUiState.Loading -> {
                                item {
                                    Surface(
                                        shape = RoundedCornerShape(24.dp),
                                        color = DojoGlassCardFrost,
                                        border = BorderStroke(1.dp, DojoPurpleBorderGlow)
                                    ) {
                                        Column(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(32.dp),
                                            horizontalAlignment = Alignment.CenterHorizontally,
                                            verticalArrangement = Arrangement.spacedBy(16.dp)
                                        ) {
                                            CircularProgressIndicator(
                                                color = DojoPurpleRoyal,
                                                modifier = Modifier.size(44.dp)
                                            )
                                            Text(
                                                text = stringResource(R.string.meal_plan_loading),
                                                style = MaterialTheme.typography.titleMedium,
                                                color = DojoInk
                                            )
                                        }
                                    }
                                }
                            }

                            is MealPlanUiState.Success -> {
                                val plan = state.plan
                                item {
                                    MealPlanSummaryCard(plan = plan)
                                }
                                item {
                                    MacroBreakdownChartCard(plan = plan)
                                }
                                items(plan.meals) { meal ->
                                    MealCard(meal = meal)
                                }
                                if (plan.hydrationTip.isNotBlank() || plan.coachTip.isNotBlank()) {
                                    item {
                                        TipsCard(plan = plan)
                                    }
                                }
                                item {
                                    val copiedMsg = stringResource(R.string.meal_plan_copied_msg)
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        Button(
                                            onClick = {
                                                copyMealPlanToClipboard(context, plan.toShareableText())
                                                onShowMessage(copiedMsg)
                                            },
                                            modifier = Modifier
                                                .weight(1f)
                                                .height(48.dp)
                                                .testTag("copy_meal_plan_btn"),
                                            shape = RoundedCornerShape(14.dp),
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = DojoPurpleRoyal,
                                                contentColor = Color.White
                                            )
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.ContentCopy,
                                                contentDescription = null,
                                                modifier = Modifier.size(18.dp)
                                            )
                                            Spacer(modifier = Modifier.size(6.dp))
                                            Text(stringResource(R.string.meal_plan_copy_btn))
                                        }

                                        OutlinedButton(
                                            onClick = { viewModel.resetMealPlan() },
                                            modifier = Modifier
                                                .weight(1f)
                                                .height(48.dp)
                                                .testTag("new_meal_plan_btn"),
                                            shape = RoundedCornerShape(14.dp),
                                            border = BorderStroke(1.dp, DojoPurpleRoyal)
                                        ) {
                                            Text(
                                                text = stringResource(R.string.meal_plan_new_btn),
                                                color = DojoPurpleImperial
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        item { Spacer(modifier = Modifier.height(24.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun GlassInputField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    placeholder: String,
    testTag: String,
    minLines: Int = 1
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        placeholder = { Text(placeholder, color = DojoMuted) },
        minLines = minLines,
        maxLines = 4,
        modifier = Modifier
            .fillMaxWidth()
            .testTag(testTag),
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = DojoPurpleRoyal,
            unfocusedBorderColor = DojoPurpleBorderGlow,
            focusedContainerColor = Color.White.copy(alpha = 0.75f),
            unfocusedContainerColor = Color.White.copy(alpha = 0.60f),
            focusedTextColor = DojoInk,
            unfocusedTextColor = DojoInk,
            focusedLabelColor = DojoPurpleImperial,
            unfocusedLabelColor = DojoMuted
        )
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MealPlanSummaryCard(plan: MealPlanResult) {
    Surface(
        shape = RoundedCornerShape(24.dp),
        color = DojoGlassCardFrost,
        border = BorderStroke(1.dp, DojoPurpleBorderGlow)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.RestaurantMenu,
                    contentDescription = null,
                    tint = DojoPurpleRoyal
                )
                Text(
                    text = plan.planTitle,
                    style = MaterialTheme.typography.titleLarge,
                    color = DojoInk
                )
            }
            Text(
                text = plan.summary,
                style = MaterialTheme.typography.bodyMedium,
                color = DojoTextLight
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (plan.dailyCalories > 0) {
                    MacroPill("کالری: ${plan.dailyCalories} kcal", DojoPurpleRoyal)
                }
                if (plan.proteinTarget.isNotBlank()) {
                    MacroPill("پروتئین: ${plan.proteinTarget}", DojoPurpleImperial)
                }
                if (plan.carbsTarget.isNotBlank()) {
                    MacroPill("کربوهیدرات: ${plan.carbsTarget}", DojoGoldDark)
                }
                if (plan.fatTarget.isNotBlank()) {
                    MacroPill("چربی: ${plan.fatTarget}", DojoMuted)
                }
            }
        }
    }
}

@Composable
private fun MacroPill(text: String, accentColor: Color) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = accentColor.copy(alpha = 0.14f),
        border = BorderStroke(1.dp, accentColor.copy(alpha = 0.28f))
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            color = accentColor,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
        )
    }
}

@Composable
private fun MealCard(meal: MealItem) {
    Surface(
        shape = RoundedCornerShape(22.dp),
        color = DojoGlassCardFrost,
        border = BorderStroke(1.dp, DojoPurpleBorderGlow)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = meal.mealTitle,
                        style = MaterialTheme.typography.titleMedium,
                        color = DojoInk
                    )
                    if (meal.timeRange.isNotBlank()) {
                        Text(
                            text = meal.timeRange,
                            style = MaterialTheme.typography.bodySmall,
                            color = DojoMuted
                        )
                    }
                }
                if (meal.calories > 0) {
                    MacroPill("${meal.calories} کیلوکالری", DojoPurpleRoyal)
                }
            }

            meal.foods.forEach { food ->
                Text(
                    text = "• $food",
                    style = MaterialTheme.typography.bodyMedium,
                    color = DojoInk
                )
            }

            if (meal.proteinGrams > 0 || meal.carbsGrams > 0 || meal.fatGrams > 0) {
                Text(
                    text = "پروتئین ${meal.proteinGrams}g  |  کربوهیدرات ${meal.carbsGrams}g  |  چربی ${meal.fatGrams}g",
                    style = MaterialTheme.typography.labelSmall,
                    color = DojoMuted
                )
            }

            if (meal.notes.isNotBlank()) {
                Text(
                    text = meal.notes,
                    style = MaterialTheme.typography.bodySmall,
                    color = DojoPurpleImperial
                )
            }
        }
    }
}

@Composable
private fun TipsCard(plan: MealPlanResult) {
    Surface(
        shape = RoundedCornerShape(22.dp),
        color = DojoGlassCardFrost,
        border = BorderStroke(1.dp, DojoPurpleBorderGlow)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (plan.hydrationTip.isNotBlank()) {
                Row(
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.LocalDrink,
                        contentDescription = null,
                        tint = DojoPurpleRoyal,
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        text = plan.hydrationTip,
                        style = MaterialTheme.typography.bodySmall,
                        color = DojoTextLight
                    )
                }
            }
            if (plan.coachTip.isNotBlank()) {
                Row(
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.TipsAndUpdates,
                        contentDescription = null,
                        tint = DojoGoldDark,
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        text = plan.coachTip,
                        style = MaterialTheme.typography.bodySmall,
                        color = DojoTextLight
                    )
                }
            }
        }
    }
}

private fun copyMealPlanToClipboard(context: Context, text: String) {
    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
    cm.setPrimaryClip(ClipData.newPlainText("arslan_dojo_meal_plan", text))
}
