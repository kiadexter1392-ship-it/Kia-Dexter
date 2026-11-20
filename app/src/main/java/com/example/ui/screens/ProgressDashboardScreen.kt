package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Timeline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.R
import com.example.ai.GeminiUiViewModel
import com.example.ai.ProgressLogsUiState
import com.example.data.NewProgressLogRequest
import com.example.data.ProgressAnalytics
import com.example.data.ProgressLogCategory
import com.example.data.WorkoutProgressLogDoc
import com.example.ui.components.CloudAccountStatusCard
import com.example.ui.components.FitnessMilestonesLineChartCard
import com.example.ui.components.ProgressKpiGrid
import com.example.ui.components.WorkoutFrequencyChartCard
import com.example.ui.theme.DojoCreamBot
import com.example.ui.theme.DojoGlassCardFrost
import com.example.ui.theme.DojoGold
import com.example.ui.theme.DojoGoldDark
import com.example.ui.theme.DojoGreen
import com.example.ui.theme.DojoInk
import com.example.ui.theme.DojoMuted
import com.example.ui.theme.DojoPurpleBorderGlow
import com.example.ui.theme.DojoPurpleImperial
import com.example.ui.theme.DojoPurpleRoyal
import com.example.ui.theme.DojoRed
import com.example.ui.theme.DojoTextLight
import com.example.util.JalaliCalendar
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProgressDashboardScreen(
    viewModel: GeminiUiViewModel,
    userDisplayName: String,
    userEmail: String,
    onSignOut: () -> Unit,
    onBack: () -> Unit
) {
    val logsState by viewModel.progressLogsState.collectAsStateWithLifecycle()
    val isSaving by viewModel.isSavingProgress.collectAsStateWithLifecycle()
    var showAddSheet by rememberSaveable { mutableStateOf(false) }

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
                            onClick = onBack,
                            modifier = Modifier
                                .size(48.dp)
                                .testTag("progress_back_btn")
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = stringResource(R.string.progress_back_desc),
                                tint = DojoPurpleImperial
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = stringResource(R.string.progress_dashboard_title),
                                style = MaterialTheme.typography.titleLarge,
                                color = DojoInk,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = stringResource(R.string.progress_dashboard_subtitle),
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

                        item {
                            Button(
                                onClick = { showAddSheet = true },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(50.dp)
                                    .testTag("open_add_progress_sheet_btn"),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = DojoPurpleRoyal,
                                    contentColor = Color.White
                                )
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Add,
                                    contentDescription = null,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.size(8.dp))
                                Text(
                                    text = stringResource(R.string.progress_add_log_btn),
                                    style = MaterialTheme.typography.labelLarge
                                )
                            }
                        }

                        when (val state = logsState) {
                            is ProgressLogsUiState.Loading -> {
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
                                            verticalArrangement = Arrangement.spacedBy(14.dp)
                                        ) {
                                            CircularProgressIndicator(
                                                color = DojoPurpleRoyal,
                                                modifier = Modifier.size(40.dp)
                                            )
                                            Text(
                                                text = stringResource(R.string.progress_loading),
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = DojoInk
                                            )
                                        }
                                    }
                                }
                            }

                            is ProgressLogsUiState.Error -> {
                                item {
                                    Surface(
                                        shape = RoundedCornerShape(20.dp),
                                        color = DojoGlassCardFrost,
                                        border = BorderStroke(1.dp, DojoRed.copy(alpha = 0.45f))
                                    ) {
                                        Text(
                                            text = state.message,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = DojoRed,
                                            modifier = Modifier.padding(18.dp)
                                        )
                                    }
                                }
                            }

                            is ProgressLogsUiState.Success -> {
                                val summary = ProgressAnalytics.compute(state.logs)
                                if (!summary.hasAnyLogs) {
                                    item {
                                        EmptyProgressStateCard(
                                            onAddClick = { showAddSheet = true }
                                        )
                                    }
                                } else {
                                    item {
                                        ProgressKpiGrid(summary = summary)
                                    }
                                    item {
                                        WorkoutFrequencyChartCard(buckets = summary.weeklyBuckets)
                                    }
                                    item {
                                        FitnessMilestonesLineChartCard(
                                            points = summary.trendPoints,
                                            latestWeightKg = summary.latestWeightKg
                                        )
                                    }
                                    item {
                                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                            Text(
                                                text = stringResource(R.string.progress_history_title),
                                                style = MaterialTheme.typography.titleMedium,
                                                fontWeight = FontWeight.Bold,
                                                color = DojoInk
                                            )
                                            Text(
                                                text = stringResource(R.string.progress_history_subtitle),
                                                style = MaterialTheme.typography.bodySmall,
                                                color = DojoMuted
                                            )
                                        }
                                    }
                                    items(
                                        items = state.logs,
                                        key = { it.id.ifBlank { "${it.sessionDateIso}_${it.title}" } }
                                    ) { log ->
                                        ProgressHistoryCard(log = log)
                                    }
                                }
                            }
                        }

                        item { Spacer(modifier = Modifier.height(24.dp)) }
                    }
                }
            }

            if (showAddSheet) {
                AddProgressLogSheet(
                    isSaving = isSaving,
                    onDismiss = { if (!isSaving) showAddSheet = false },
                    onSubmit = { req ->
                        viewModel.logWorkoutProgress(
                            request = req,
                            onSaved = { showAddSheet = false }
                        )
                    }
                )
            }
        }
    }
}

@Composable
private fun EmptyProgressStateCard(onAddClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("progress_empty_state"),
        shape = RoundedCornerShape(24.dp),
        color = DojoGlassCardFrost,
        border = BorderStroke(1.dp, DojoPurpleBorderGlow)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(DojoPurpleRoyal.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Timeline,
                    contentDescription = stringResource(R.string.progress_empty_title),
                    tint = DojoPurpleRoyal,
                    modifier = Modifier.size(30.dp)
                )
            }
            Text(
                text = stringResource(R.string.progress_empty_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = DojoInk,
                textAlign = TextAlign.Center
            )
            Text(
                text = stringResource(R.string.progress_empty_subtitle),
                style = MaterialTheme.typography.bodySmall,
                color = DojoTextLight,
                textAlign = TextAlign.Center
            )
            Button(
                onClick = onAddClick,
                modifier = Modifier
                    .height(48.dp)
                    .testTag("empty_state_add_progress_btn"),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = DojoPurpleRoyal,
                    contentColor = Color.White
                )
            ) {
                Text(stringResource(R.string.progress_add_log_btn))
            }
        }
    }
}

@Composable
private fun ProgressHistoryCard(log: WorkoutProgressLogDoc) {
    val isMilestone = log.resolvedCategory() == ProgressLogCategory.MILESTONE
    val accent = if (isMilestone) DojoGoldDark else DojoPurpleRoyal
    val jalaliDate = remember(log.sessionDateIso) {
        JalaliCalendar.toJalaliFromIso(log.sessionDateIso)
            ?.let { JalaliCalendar.formatJalaliNamed(it) }
            ?: log.createdAt?.toDate()?.time?.let { JalaliCalendar.formatJalaliShort(it) }
            ?: "—"
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("progress_history_item"),
        shape = RoundedCornerShape(20.dp),
        color = DojoGlassCardFrost,
        border = BorderStroke(1.dp, DojoPurpleBorderGlow)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(accent.copy(alpha = 0.14f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (isMilestone) Icons.Default.EmojiEvents else Icons.Default.FitnessCenter,
                            contentDescription = null,
                            tint = accent,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Column {
                        Text(
                            text = log.title,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = DojoInk
                        )
                        Text(
                            text = jalaliDate,
                            style = MaterialTheme.typography.labelSmall,
                            color = DojoMuted
                        )
                    }
                }

                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = DojoGreen.copy(alpha = 0.14f),
                    border = BorderStroke(1.dp, DojoGreen.copy(alpha = 0.30f))
                ) {
                    Text(
                        text = "${JalaliCalendar.faNum(log.readinessScore)}/۱۰۰",
                        style = MaterialTheme.typography.labelMedium,
                        color = DojoGreen,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (log.durationMinutes > 0L) {
                    BadgeTag(
                        text = "${JalaliCalendar.faNum(log.durationMinutes)} ${stringResource(R.string.progress_kpi_minutes)}",
                        color = DojoPurpleImperial
                    )
                }
                log.weightKgOrNull()?.let { kg ->
                    BadgeTag(
                        text = "${JalaliCalendar.faNum("%.1f".format(kg))} kg",
                        color = DojoGoldDark
                    )
                }
            }

            if (log.notes.isNotBlank()) {
                Text(
                    text = log.notes,
                    style = MaterialTheme.typography.bodySmall,
                    color = DojoTextLight
                )
            }
        }
    }
}

@Composable
private fun BadgeTag(text: String, color: Color) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = color.copy(alpha = 0.12f)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddProgressLogSheet(
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (NewProgressLogRequest) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var category by remember { mutableStateOf(ProgressLogCategory.WORKOUT) }
    var title by remember { mutableStateOf("") }
    var durationInput by remember { mutableStateOf("60") }
    var readinessSlider by remember { mutableFloatStateOf(85f) }
    var weightInput by remember { mutableStateOf("") }
    var notesInput by remember { mutableStateOf("") }
    var titleError by remember { mutableStateOf(false) }

    val titleValidationMsg = stringResource(R.string.progress_validation_title)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DojoCreamBot
    ) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .imePadding()
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = stringResource(R.string.progress_sheet_title),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = DojoInk
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = category == ProgressLogCategory.WORKOUT,
                        onClick = { category = ProgressLogCategory.WORKOUT },
                        modifier = Modifier.testTag("log_category_workout_chip"),
                        label = { Text(stringResource(R.string.progress_cat_workout)) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = DojoPurpleRoyal,
                            selectedLabelColor = Color.White,
                            containerColor = Color.White,
                            labelColor = DojoInk
                        )
                    )
                    FilterChip(
                        selected = category == ProgressLogCategory.MILESTONE,
                        onClick = { category = ProgressLogCategory.MILESTONE },
                        modifier = Modifier.testTag("log_category_milestone_chip"),
                        label = { Text(stringResource(R.string.progress_cat_milestone)) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = DojoGold,
                            selectedLabelColor = DojoInk,
                            containerColor = Color.White,
                            labelColor = DojoInk
                        )
                    )
                }

                OutlinedTextField(
                    value = title,
                    onValueChange = {
                        title = it
                        if (titleError && it.isNotBlank()) titleError = false
                    },
                    label = { Text(stringResource(R.string.progress_title_label)) },
                    placeholder = { Text(stringResource(R.string.progress_title_hint), color = DojoMuted) },
                    isError = titleError,
                    supportingText = if (titleError) {
                        { Text(titleValidationMsg, color = DojoRed) }
                    } else null,
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("progress_title_input"),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DojoPurpleRoyal,
                        unfocusedBorderColor = DojoPurpleBorderGlow,
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White.copy(alpha = 0.85f),
                        focusedTextColor = DojoInk,
                        unfocusedTextColor = DojoInk
                    )
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = durationInput,
                        onValueChange = { durationInput = JalaliCalendar.enNum(it).filter(Char::isDigit).take(3) },
                        label = { Text(stringResource(R.string.progress_duration_label)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("progress_duration_input"),
                        shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = DojoPurpleRoyal,
                            unfocusedBorderColor = DojoPurpleBorderGlow,
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White.copy(alpha = 0.85f),
                            focusedTextColor = DojoInk,
                            unfocusedTextColor = DojoInk
                        )
                    )
                    OutlinedTextField(
                        value = weightInput,
                        onValueChange = { raw ->
                            val clean = JalaliCalendar.enNum(raw).filter { ch -> ch.isDigit() || ch == '.' }
                            if (clean.count { it == '.' } <= 1) weightInput = clean.take(5)
                        },
                        label = { Text(stringResource(R.string.progress_weight_label)) },
                        placeholder = { Text(stringResource(R.string.progress_weight_hint), color = DojoMuted) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("progress_weight_input"),
                        shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = DojoPurpleRoyal,
                            unfocusedBorderColor = DojoPurpleBorderGlow,
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White.copy(alpha = 0.85f),
                            focusedTextColor = DojoInk,
                            unfocusedTextColor = DojoInk
                        )
                    )
                }

                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = stringResource(R.string.progress_score_label),
                            style = MaterialTheme.typography.labelLarge,
                            color = DojoInk
                        )
                        Text(
                            text = "${JalaliCalendar.faNum(readinessSlider.roundToInt())}/۱۰۰",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = DojoPurpleRoyal
                        )
                    }
                    Slider(
                        value = readinessSlider,
                        onValueChange = { readinessSlider = it },
                        valueRange = 20f..100f,
                        modifier = Modifier.testTag("progress_readiness_slider"),
                        colors = SliderDefaults.colors(
                            thumbColor = DojoPurpleRoyal,
                            activeTrackColor = DojoPurpleRoyal,
                            inactiveTrackColor = DojoPurpleBorderGlow
                        )
                    )
                }

                OutlinedTextField(
                    value = notesInput,
                    onValueChange = { notesInput = it.take(450) },
                    label = { Text(stringResource(R.string.progress_notes_label)) },
                    placeholder = { Text(stringResource(R.string.progress_notes_hint), color = DojoMuted) },
                    minLines = 2,
                    maxLines = 3,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("progress_notes_input"),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = DojoPurpleRoyal,
                        unfocusedBorderColor = DojoPurpleBorderGlow,
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White.copy(alpha = 0.85f),
                        focusedTextColor = DojoInk,
                        unfocusedTextColor = DojoInk
                    )
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp, bottom = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        enabled = !isSaving,
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .testTag("progress_cancel_btn"),
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, DojoPurpleRoyal)
                    ) {
                        Text(stringResource(R.string.progress_cancel_btn), color = DojoPurpleImperial)
                    }

                    Button(
                        onClick = {
                            if (title.trim().isEmpty()) {
                                titleError = true
                                return@Button
                            }
                            val parsedDuration = durationInput.toIntOrNull()?.coerceIn(0, 600)
                                ?: if (category == ProgressLogCategory.WORKOUT) 45 else 0
                            val parsedWeightTenths = weightInput.toDoubleOrNull()
                                ?.let { (it * 10.0).roundToInt() }
                                ?.takeIf { it in 200..3000 }
                                ?: 0
                            onSubmit(
                                NewProgressLogRequest(
                                    category = category,
                                    title = title.trim(),
                                    durationMinutes = parsedDuration,
                                    readinessScore = readinessSlider.roundToInt().coerceIn(1, 100),
                                    weightTenthsKg = parsedWeightTenths,
                                    sessionDateIso = JalaliCalendar.todayDateIso(),
                                    notes = notesInput.trim()
                                )
                            )
                        },
                        enabled = !isSaving,
                        modifier = Modifier
                            .weight(1.4f)
                            .height(48.dp)
                            .testTag("progress_submit_btn"),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = DojoPurpleRoyal,
                            contentColor = Color.White
                        )
                    ) {
                        if (isSaving) {
                            CircularProgressIndicator(
                                color = Color.White,
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text(stringResource(R.string.progress_submit_btn))
                        }
                    }
                }
            }
        }
    }
}
