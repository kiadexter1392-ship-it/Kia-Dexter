package com.example.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.R
import com.example.ai.SavedPlansUiState
import com.example.data.SavedMealPlanDoc
import com.example.ui.theme.DojoGlassCardFrost
import com.example.ui.theme.DojoGreen
import com.example.ui.theme.DojoInk
import com.example.ui.theme.DojoLineSoft
import com.example.ui.theme.DojoMuted
import com.example.ui.theme.DojoPurpleBorderGlow
import com.example.ui.theme.DojoPurpleImperial
import com.example.ui.theme.DojoPurpleRoyal
import com.example.ui.theme.DojoRed
import com.example.ui.theme.DojoTextLight
import com.example.util.JalaliCalendar
import com.google.firebase.Timestamp
import java.util.Calendar

@Composable
fun CloudAccountStatusCard(
    displayName: String,
    email: String,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = DojoGlassCardFrost,
        border = BorderStroke(1.dp, DojoPurpleBorderGlow)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = DojoGreen.copy(alpha = 0.14f)
            ) {
                Icon(
                    imageVector = Icons.Default.CloudDone,
                    contentDescription = stringResource(R.string.auth_synced_badge),
                    tint = DojoGreen,
                    modifier = Modifier
                        .padding(8.dp)
                        .size(20.dp)
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = displayName.ifBlank { stringResource(R.string.auth_synced_badge) },
                    style = MaterialTheme.typography.titleSmall,
                    color = DojoInk,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = if (email.isNotBlank()) {
                        "$email • ${stringResource(R.string.auth_synced_badge)}"
                    } else {
                        stringResource(R.string.auth_synced_badge)
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = DojoMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            OutlinedButton(
                onClick = onSignOut,
                modifier = Modifier
                    .heightIn(min = 48.dp)
                    .testTag("cloud_sign_out_btn"),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, DojoPurpleBorderGlow)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Logout,
                    contentDescription = stringResource(R.string.auth_sign_out_btn),
                    tint = DojoPurpleImperial,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.size(5.dp))
                Text(
                    text = stringResource(R.string.logout_label),
                    style = MaterialTheme.typography.labelMedium,
                    color = DojoPurpleImperial
                )
            }
        }
    }
}

@Composable
fun SavedMealPlansHistoryCard(
    savedPlansState: SavedPlansUiState,
    onSelectPlan: (SavedMealPlanDoc) -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .testTag("saved_meal_plans_card"),
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
                    imageVector = Icons.Default.History,
                    contentDescription = stringResource(R.string.cloud_history_title),
                    tint = DojoPurpleRoyal
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.cloud_history_title),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = DojoInk
                    )
                    Text(
                        text = stringResource(R.string.cloud_history_subtitle),
                        style = MaterialTheme.typography.bodySmall,
                        color = DojoMuted
                    )
                }
            }

            when (savedPlansState) {
                is SavedPlansUiState.Loading -> {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                            color = DojoPurpleRoyal
                        )
                        Text(
                            text = stringResource(R.string.cloud_history_loading),
                            style = MaterialTheme.typography.bodySmall,
                            color = DojoMuted
                        )
                    }
                }
                is SavedPlansUiState.Error -> {
                    Text(
                        text = savedPlansState.message,
                        style = MaterialTheme.typography.bodySmall,
                        color = DojoRed
                    )
                }
                is SavedPlansUiState.Success -> {
                    if (savedPlansState.plans.isEmpty()) {
                        Text(
                            text = stringResource(R.string.cloud_history_empty),
                            style = MaterialTheme.typography.bodySmall,
                            color = DojoMuted
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            savedPlansState.plans.forEachIndexed { index, planDoc ->
                                SavedPlanHistoryRow(
                                    planDoc = planDoc,
                                    testTag = "saved_plan_item_$index",
                                    onClick = { onSelectPlan(planDoc) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SavedPlanHistoryRow(
    planDoc: SavedMealPlanDoc,
    testTag: String,
    onClick: () -> Unit
) {
    val dateLabel = formatTimestampJalali(planDoc.createdAt)
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .testTag(testTag),
        shape = RoundedCornerShape(16.dp),
        color = Color.White.copy(alpha = 0.62f),
        border = BorderStroke(1.dp, DojoLineSoft)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                Text(
                    text = planDoc.planTitle.ifBlank { planDoc.goal },
                    style = MaterialTheme.typography.titleSmall,
                    color = DojoInk,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = buildString {
                        append(planDoc.goal)
                        if (planDoc.dailyCalories > 0) {
                            append(" • ${planDoc.dailyCalories} کیلوکالری")
                        }
                        if (dateLabel.isNotBlank()) {
                            append(" • $dateLabel")
                        }
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = DojoTextLight,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                contentDescription = "مشاهده برنامه",
                tint = DojoPurpleRoyal
            )
        }
    }
}

private fun formatTimestampJalali(ts: Timestamp?): String {
    if (ts == null) return ""
    val cal = Calendar.getInstance().apply { time = ts.toDate() }
    val j = JalaliCalendar.gregorianToJalali(
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH) + 1,
        cal.get(Calendar.DAY_OF_MONTH)
    )
    return JalaliCalendar.formatJalaliNamed(j)
}
