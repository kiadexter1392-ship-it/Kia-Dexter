package com.example.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Locale

class JalaliCalendarTest {

    @Test
    fun nowruz1405_roundTripConversion() {
        // 1405/01/01 corresponds to Gregorian 2026-03-21 (Saturday / شنبه)
        val jalali = JalaliCalendar.gregorianToJalali(2026, 3, 21)
        assertEquals(JalaliDate(1405, 1, 1), jalali)

        val greg = JalaliCalendar.jalaliToGregorian(1405, 1, 1)
        assertEquals(Triple(2026, 3, 21), greg)
        assertEquals("شنبه", JalaliCalendar.jalaliWeekday(1405, 1, 1))
    }

    @Test
    fun jalaliLeapYear_andMonthLengths() {
        // 1403 is a Jalali leap year (30 Esfand -> 2025-03-20), 1404 & 1405 are non-leap
        assertTrue(JalaliCalendar.isJalaliLeap(1403))
        assertFalse(JalaliCalendar.isJalaliLeap(1404))
        assertFalse(JalaliCalendar.isJalaliLeap(1405))

        assertEquals(30, JalaliCalendar.jalaliMonthLength(1403, 12))
        assertEquals(29, JalaliCalendar.jalaliMonthLength(1405, 12))
        assertEquals(31, JalaliCalendar.jalaliMonthLength(1405, 6))
        assertEquals(30, JalaliCalendar.jalaliMonthLength(1405, 7))
        assertEquals(366, JalaliCalendar.shamsiYearDays(1403))
        assertEquals(365, JalaliCalendar.shamsiYearDays(1405))

        assertEquals(Triple(2025, 3, 20), JalaliCalendar.jalaliToGregorian(1403, 12, 30))
    }

    @Test
    fun shamsiSeasons_dayOfYear_andProgress() {
        assertEquals("بهار", JalaliCalendar.shamsiSeason(1))
        assertEquals("تابستان", JalaliCalendar.shamsiSeason(5))
        assertEquals("پاییز", JalaliCalendar.shamsiSeason(8))
        assertEquals("زمستان", JalaliCalendar.shamsiSeason(12))

        // 1 Mehr = 6 * 31 + 1 = 187th day of Shamsi year
        val firstMehr = JalaliDate(1405, 7, 1)
        assertEquals(187, JalaliCalendar.shamsiDayOfYear(firstMehr))
        assertEquals(Triple(2026, 9, 23), JalaliCalendar.jalaliToGregorian(1405, 7, 1))
        val progress = JalaliCalendar.shamsiYearProgress(firstMehr)
        assertTrue(progress in 0.51f..0.52f)
    }

    @Test
    fun parsing_acceptsPersianDigits_andRejectsInvalidDates() {
        val parsedJ = JalaliCalendar.parseJalaliInput("۱۴۰۵/۰۸/۲۵")
        assertEquals(JalaliDate(1405, 8, 25), parsedJ)
        assertNull(JalaliCalendar.parseJalaliInput("1405/12/30")) // 1405 is not leap
        assertNull(JalaliCalendar.parseJalaliInput("1405/13/01"))

        val parsedG = JalaliCalendar.parseGregorianInput("2026-11-16")
        assertEquals(Triple(2026, 11, 16), parsedG)
        assertNull(JalaliCalendar.parseGregorianInput("2026-02-30"))
    }

    @Test
    fun isoFormatting_convertsServerTimestampToShamsi() {
        val formatted = JalaliCalendar.formatIsoFull("2026-03-21T14:30:00.000Z", withTime = false)
        assertNotNull(formatted)
        assertTrue(formatted.contains("فروردین"))
        assertTrue(formatted.contains("۱۴۰۵"))
    }

    @Test
    fun isoDates_remainAsciiUnderPersianLocale() {
        val original = Locale.getDefault()
        try {
            Locale.setDefault(Locale.forLanguageTag("fa-IR"))
            val todayIso = JalaliCalendar.todayDateIso()
            assertTrue("Expected ASCII yyyy-MM-dd but got: $todayIso", Regex("""^\d{4}-\d{2}-\d{2}$""").matches(todayIso))
            assertEquals("2026-03-21", JalaliCalendar.toGregorianIso(1405, 1, 1))
        } finally {
            Locale.setDefault(original)
        }
    }
}
