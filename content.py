# ============================================================
# EDIT YOUR INVITATION CONTENT HERE
# After changing anything, run:  python3 build.py
# For bilingual fields the FIRST value is Kyrgyz, the SECOND is Kazakh.
# Do not change the names on the LEFT of the = sign, only the text in quotes.
# ============================================================


# ------------------------------------------------------------
# COUPLE NAMES
# The groom's and bride's first names, shown on the cover photo
# (laid out diagonally) and in the RSVP form title bar.
# ------------------------------------------------------------
GROOM_NAME = "Бек"      # groom (the man)
BRIDE_NAME = "Софья"    # bride (the woman)


# ------------------------------------------------------------
# HOSTS  (the parents who are hosting / signing the invitation)
# Shown as the signature line at the very bottom of the page.
# ------------------------------------------------------------
HOST1_NAME = "Азамат"   # first host (e.g. father)
HOST2_NAME = "Зарема"   # second host (e.g. mother)


# ------------------------------------------------------------
# DATE  (the wedding day)
# DATE_DAY        = the day number, e.g. "12"
# DATE_MONTH_NUM  = the month as a 2-digit number, e.g. "07" for July
#                   (this only feeds the short "12.07.2026" line in the RSVP form)
# DATE_YEAR       = the 4-digit year, e.g. "2026"
# DATE_MONTH_NAME = the month spelled out, bilingual (Kyrgyz, Kazakh)
#                   shown on the scratch-to-reveal date tiles.
# ------------------------------------------------------------
DATE_DAY = "12"
DATE_MONTH_NUM = "07"
DATE_YEAR = "2026"
DATE_MONTH_NAME = ("Июль", "Шілде")   # (Kyrgyz, Kazakh)


# ------------------------------------------------------------
# VENUE  (where the wedding happens)
# VENUE_NAME    = the place name (shown as a clickable link to the map)
# VENUE_CITY    = the area / city, bilingual (Kyrgyz, Kazakh)
# VENUE_MAP_URL = the full map link (opens when the venue photo is tapped)
# ------------------------------------------------------------
VENUE_NAME = "Luna Garden"
VENUE_CITY = ("Кой-Таш, Бишкек", "Қой-Таш, Бішкек")   # (Kyrgyz, Kazakh)
VENUE_MAP_URL = "https://2gis.kg/bishkek/firm/70000001113003711"


# ------------------------------------------------------------
# SCHEDULE  (the four events of the day)
# SCHEDULE_TIMES = the four start times, in order.
# SCHEDULE_EVENTS = the four event names, each bilingual (Kyrgyz, Kazakh).
# Time #1 goes with Event #1, time #2 with event #2, and so on.
# ------------------------------------------------------------
SCHEDULE_TIMES = ("15:00", "15:30", "16:00", "22:00")
SCHEDULE_EVENTS = (
    ("Коноктор жыйыны",              "Қонақтар жиыны"),                # event 1 @ 15:00
    ("Нике күбөлүгүн тапшыруу аземи", "Неке куәлігін тапсыру рәсімі"),  # event 2 @ 15:30
    ("Банкет",                       "Банкет"),                        # event 3 @ 16:00
    ("Кеченин аякташы.",             "Кештің аяқталуы."),              # event 4 @ 22:00
)


# ------------------------------------------------------------
# WELCOME LETTER  (the heartfelt note to guests)
# Each line is bilingual (Kyrgyz, Kazakh).
# LETTER_GREETING = the opening line ("Dear friends and family,")
# LETTER_BODY_1   = first paragraph
# LETTER_BODY_2   = second paragraph
# ------------------------------------------------------------
LETTER_GREETING = (
    "Урматтуу куда-кудагыйлар, туугандар, достор",
    "Құрметті құда-жегжаттар, туғандар, достар",
)
LETTER_BODY_1 = (
    "Жашообуздагы эң бактылуу күндөрдүн бирин биз менен бөлүшүүгө чакырабыз.",
    "Өміріміздегі ең бақытты күндердің бірін бізбен бөлісуге шақырамыз.",
)
LETTER_BODY_2 = (
    "Бул күндү биз үчүн эң жакын жана кымбат адамдарыбыздын курчоосунда өткөрүү — биз үчүн чоң сыймык!",
    "Бұл күнді біз үшін ең жақын және қымбат адамдарымыздың ортасында өткеру — біз үшін үлкен мәртебе!",
)


# ------------------------------------------------------------
# RSVP LABELS  (the wording on the reply form popup)
# Each label is bilingual (Kyrgyz, Kazakh).
# ------------------------------------------------------------
RSVP_TITLE   = ("Катышууну ырастаңыз", "Қатысуыңызды растаңыз")          # form heading
RSVP_NAME    = ("Атыңыз жана фамилияңыз", "Атыңыз бен тегіңіз")          # name field placeholder
RSVP_YES     = ("Ооба, келем", "Иә, келемін")                            # "yes, I'll come"
RSVP_NO      = ("Келе албайм", "Келе алмаймын")                          # "I can't come"
RSVP_GUESTS  = ("Канча киши келет?", "Қанша адам келеді?")               # "how many people?"
RSVP_WISH    = ("Жаңы үй-бүлөгө каалоо-тилек", "Жас жұбайларға тілек")   # wishes for the couple
RSVP_SEND    = ("Жөнөтүү", "Жіберу")                                     # send button
RSVP_SENDING = ("Жөнөтүлүүдө…", "Жіберілуде…")                           # "sending..." status
RSVP_OK      = ("Рахмат! Жообуңуз кабыл алынды ✨", "Рахмет! Жауабыңыз қабылданды ✨")  # success message
RSVP_ERR     = ("Ката кетти, кайра аракет кылыңыз.", "Қате кетті, қайталап көріңіз.")  # error message
RSVP_MAP     = ("Картадан көрүү үчүн басыңыз", "Картадан көру үшін басыңыз")     # "tap to view on map" (2GIS logo prefixed by addMapCap)
RSVP_HOSTSLAB = ("Урматтоо менен, той ээлери", "Құрметпен, той иелері")  # signature line above host names
