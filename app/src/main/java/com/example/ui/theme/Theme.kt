package com.example.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

private val DojoLightColorScheme = lightColorScheme(
    primary = DojoGold,
    onPrimary = Color.White,
    primaryContainer = DojoGoldSoft,
    onPrimaryContainer = DojoInk,
    secondary = DojoInk,
    onSecondary = Color.White,
    secondaryContainer = DojoGlassSubtle,
    onSecondaryContainer = DojoInk,
    tertiary = DojoBlue,
    onTertiary = Color.White,
    background = DojoCreamTop,
    onBackground = DojoInk,
    surface = DojoGlassSurface,
    onSurface = DojoInk,
    surfaceVariant = DojoCreamMid,
    onSurfaceVariant = DojoTextLight,
    outline = DojoAmberBorder,
    outlineVariant = DojoLineSoft,
    error = DojoRed,
    onError = Color.White,
    errorContainer = DojoRedSoft,
    onErrorContainer = DojoRed
)

val DojoShapes = Shapes(
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(24.dp)
)

@Composable
fun ArslanDojoTheme(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(
            colorScheme = DojoLightColorScheme,
            typography = DojoTypography,
            shapes = DojoShapes
        ) {
            CompositionLocalProvider(
                LocalTextStyle provides DojoTypography.bodyMedium.copy(color = DojoInk),
                content = content
            )
        }
    }
}
