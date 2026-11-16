package com.example.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.DojoAmberBorder
import com.example.ui.theme.DojoAmberGlass
import com.example.ui.theme.DojoBlue
import com.example.ui.theme.DojoBlueSoft
import com.example.ui.theme.DojoCreamBot
import com.example.ui.theme.DojoCreamMid
import com.example.ui.theme.DojoCreamTop
import com.example.ui.theme.DojoGlassBorder
import com.example.ui.theme.DojoGlassSubtle
import com.example.ui.theme.DojoGlassSurface
import com.example.ui.theme.DojoGold
import com.example.ui.theme.DojoGoldDark
import com.example.ui.theme.DojoGoldLight
import com.example.ui.theme.DojoGoldSoft
import com.example.ui.theme.DojoGreen
import com.example.ui.theme.DojoGreenSoft
import com.example.ui.theme.DojoInk
import com.example.ui.theme.DojoMuted
import com.example.ui.theme.DojoRed
import com.example.ui.theme.DojoRedSoft
import com.example.ui.theme.DojoTextLight
import com.example.ui.theme.heatColor
import com.example.ui.theme.parseHexColor
import com.example.util.DojoConstants
import com.example.util.JalaliCalendar

@Composable
fun DojoBackground(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    colors = listOf(DojoCreamTop, DojoCreamMid, DojoCreamBot),
                    start = Offset.Zero,
                    end = Offset(1200f, 1800f)
                )
            )
    ) {
        content()
    }
}

@Composable
fun DojoGlassCard(
    modifier: Modifier = Modifier,
    amberTint: Boolean = false,
    padding: Dp = 18.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val bg = if (amberTint) DojoAmberGlass else DojoGlassSurface
    val border = if (amberTint) DojoAmberBorder else DojoGlassBorder
    val shape = RoundedCornerShape(18.dp)
    val clickMod = if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier
    Surface(
        modifier = modifier
            .clip(shape)
            .then(clickMod),
        shape = shape,
        color = bg,
        border = BorderStroke(1.dp, border),
        shadowElevation = 2.dp
    ) {
        Column(
            modifier = Modifier.padding(padding),
            content = content
        )
    }
}

@Composable
fun DojoSubCard(
    modifier: Modifier = Modifier,
    padding: Dp = 14.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val shape = RoundedCornerShape(14.dp)
    val clickMod = if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier
    Surface(
        modifier = modifier
            .clip(shape)
            .then(clickMod),
        shape = shape,
        color = DojoGlassSubtle,
        border = BorderStroke(1.dp, DojoGlassBorder)
    ) {
        Column(
            modifier = Modifier.padding(padding),
            content = content
        )
    }
}

@Composable
fun DojoEnsoLogo(
    modifier: Modifier = Modifier,
    size: Dp = 36.dp,
    coralAccent: Boolean = true
) {
    Canvas(modifier = modifier.size(size)) {
        val stroke = this.size.minDimension * 0.11f
        val inset = stroke * 0.8f
        val brush = Brush.linearGradient(
            colors = if (coralAccent) listOf(Color(0xFFFF6B5E), DojoGold) else listOf(DojoGold, DojoGoldLight)
        )
        drawArc(
            brush = brush,
            startAngle = 20f,
            sweepAngle = 285f,
            useCenter = false,
            topLeft = Offset(inset, inset),
            size = Size(this.size.width - inset * 2, this.size.height - inset * 2),
            style = Stroke(width = stroke, cap = StrokeCap.Round)
        )
        drawCircle(
            brush = brush,
            radius = this.size.minDimension * 0.095f,
            center = Offset(this.size.width / 2f, this.size.height / 2f)
        )
    }
}

@Composable
fun MemberAvatar(
    fullName: String,
    colorHex: String?,
    size: Dp = 40.dp,
    fontSizeSp: Int = 14
) {
    val bg = parseHexColor(colorHex, DojoGold)
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(bg),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = DojoConstants.initials(fullName),
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = fontSizeSp.sp
        )
    }
}

enum class BadgeTone { NEUTRAL, GOLD, RED, GREEN, BLUE, DARK }

@Composable
fun DojoBadge(
    text: String,
    tone: BadgeTone = BadgeTone.NEUTRAL,
    modifier: Modifier = Modifier
) {
    val (bg, fg) = when (tone) {
        BadgeTone.GOLD -> DojoGoldSoft to DojoGoldDark
        BadgeTone.RED -> DojoRedSoft to DojoRed
        BadgeTone.GREEN -> DojoGreenSoft to DojoGreen
        BadgeTone.BLUE -> DojoBlueSoft to DojoBlue
        BadgeTone.DARK -> Color(0x141A1A2E) to DojoTextLight
        BadgeTone.NEUTRAL -> Color(0x0F000000) to DojoMuted
    }
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = text,
            color = fg,
            style = MaterialTheme.typography.labelSmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
fun StatusBadge(status: String) {
    val tone = when (status) {
        "done" -> BadgeTone.GREEN
        "doing" -> BadgeTone.GOLD
        else -> BadgeTone.RED
    }
    DojoBadge(text = DojoConstants.statusLabel(status), tone = tone)
}

@Composable
fun HeatBadge(score: Int?) {
    val color = heatColor(score)
    val bg = color.copy(alpha = 0.14f)
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .padding(horizontal = 9.dp, vertical = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = score?.let { JalaliCalendar.faNum(it) } ?: "—",
            color = color,
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.labelMedium
        )
    }
}

@Composable
fun StatTile(
    label: String,
    value: String,
    sub: String,
    accentColor: Color,
    modifier: Modifier = Modifier
) {
    DojoGlassCard(modifier = modifier, padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(accentColor)
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = DojoMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.headlineMedium,
            color = DojoInk,
            fontWeight = FontWeight.ExtraBold
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = sub,
            style = MaterialTheme.typography.bodySmall,
            color = DojoMuted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
fun CardSectionHeader(
    title: String,
    dotColor: Color = DojoGold,
    trailing: (@Composable () -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(dotColor)
            )
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = DojoInk,
                fontWeight = FontWeight.Bold
            )
        }
        if (trailing != null) trailing()
    }
}

@Composable
fun EmptyStateView(
    text: String,
    iconEmoji: String = "🗂",
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 28.dp, horizontal = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = iconEmoji, fontSize = 36.sp)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = DojoMuted,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
fun DojoPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    containerColor: Color = DojoGold
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(48.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = containerColor,
            contentColor = Color.White
        ),
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 10.dp)
    ) {
        Text(text = text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun DojoGhostButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(48.dp),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, DojoAmberBorder),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = DojoInk),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp)
    ) {
        Text(text = text, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun DojoFilterChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val bg = if (selected) DojoGoldSoft else DojoGlassSubtle
    val border = if (selected) DojoGold else DojoGlassBorder
    val fg = if (selected) DojoGoldDark else DojoMuted
    Box(
        modifier = modifier
            .height(38.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(20.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = fg,
            style = MaterialTheme.typography.labelMedium,
            maxLines = 1
        )
    }
}
