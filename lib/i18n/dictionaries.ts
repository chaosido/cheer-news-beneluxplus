/**
 * UI string dictionaries (NL + EN + FR), organized by area.
 *
 * SCOPE: UI chrome and static editorial copy ONLY. Firestore DATA — club names,
 * event titles, venue names, user submissions, blurbs, coach bios — is NEVER
 * translated; it is proper-noun / live data and flows through verbatim.
 *
 * TYPING: `nl` is the canonical shape via `satisfies Dictionary`-by-inference —
 * we derive the `Dictionary` type FROM the `nl` object, then require `en` and
 * `fr` to match it exactly. A missing or misspelled key in `en`/`fr` is
 * therefore a compile error (see the `satisfies Dictionary` on `en`/`fr`).
 *
 * Some entries are functions (e.g. result counts, "+N" pluralization) so callers
 * pass runtime values; both languages implement the same signature.
 */
import type { Locale } from "@/lib/i18n/config";
import type { EventType, SubmissionKind } from "@/lib/types";

/** The Dutch dictionary is the canonical source of the shape. */
export const nl = {
  // ---- Site chrome: header, footer, nav, language toggle ----
  header: {
    nav: {
      home: "Kaart & agenda",
      clubs: "Clubs",
      coaches: "Coaches",
      about: "Over",
      admin: "Admin",
    },
    submitCta: "Ontbrekend item melden",
    skipToContent: "Naar de inhoud",
    csnLogoAlt: "Cheersport Nederland",
  },
  footer: {
    tagline: "Cheer Overview, een open overzicht van cheerleading.",
    about: "Over",
    contribute: "Bijdragen",
    privacy: "Privacy",
    builtBy: "Gemaakt door",
    csnLogoAlt: "Cheersport Nederland",
  },
  language: {
    /** aria-label for the language switcher group. */
    label: "Taal",
    nl: "NL",
    en: "EN",
    fr: "FR",
    nlFull: "Nederlands",
    enFull: "Engels",
    frFull: "Frans",
    /** aria-label per option, e.g. "Wissel naar Nederlands". */
    switchTo: (full: string) => `Wissel naar ${full}`,
  },

  // ---- Event-type labels (UI chrome over EventType enum) ----
  eventType: {
    competition: "Wedstrijd",
    open_gym: "Open gym",
    workshop: "Workshop",
    tryout: "Tryout",
    showcase: "Showcase",
    other: "Overig",
  } satisfies Record<EventType, string>,

  // ---- Team taxonomy labels ----
  // Numeric L-code keys; labels show the ICU word-name (CSN/NK convention).
  level: {
    "1": "Novice (L1)",
    "2": "Intermediate (L2)",
    "3": "Median (L3)",
    "4": "Advanced (L4)",
    "5": "Elite (L5)",
    "6": "Premier (L6)",
    "7": "Premier (L7)",
  },
  discipline: {
    cheer: "Cheer",
    performance_cheer: "Performance Cheer",
  },
  danceStyle: {
    pom: "Pom",
    hip_hop: "Hip Hop",
    jazz: "Jazz",
    kick: "Kick",
    pom_doubles: "Pom Doubles",
    hip_hop_doubles: "Hip Hop Doubles",
  },
  tier: {
    competition: "Wedstrijd",
    prep: "Prep",
    recreational: "Recreatief",
  },
  division: {
    all_girl: "All Girl",
    coed: "Coed",
    all_boy: "All Boy",
  },
  ageGroup: {
    mini: "Mini",
    youth: "Youth",
    junior: "Junior",
    senior: "Senior",
    open: "Open",
  },

  // ---- Weekday names (for recurring slots) ----
  weekdays: [
    "Maandag",
    "Dinsdag",
    "Woensdag",
    "Donderdag",
    "Vrijdag",
    "Zaterdag",
    "Zondag",
  ],

  // ---- Home: map + agenda split-view ----
  home: {
    mobileTab: { map: "Kaart", agenda: "Agenda" },
    mapAriaLabel: "Kaart van cheerleadingclubs",
    agendaAriaLabel: "Agenda van evenementen",
    emptyMap: {
      title: "Nog geen clubs op de kaart",
      hint: "Zodra clubs met een locatie zijn toegevoegd, verschijnen ze hier als pins.",
    },
    emptyAgenda: {
      title: "Nog geen evenementen",
      hint: "Wedstrijden, open gyms en workshops verschijnen hier zodra ze bekend zijn.",
    },
  },

  // ---- Agenda (Calendar component) ----
  agenda: {
    today: "Vandaag",
    tomorrow: "Morgen",
    allDay: "Hele dag",
    /** prefix for the closing time of a multi-day event's last day */
    until: "tot",
    emptyTitle: "Geen evenementen",
    emptyHint: "Geen evenementen in deze periode of met deze filters.",
    viewClub: "Bekijk club",
    viewCoach: "Bekijk coach",
    moreInfo: "Meer info",
    website: "Website",
    /** aria-label: "<title> — toon locatie op de kaart" */
    showOnMap: (title: string) => `${title} — toon locatie op de kaart`,
    /** aria-label: "<title> — <linklabel>" */
    rowLink: (title: string, action: string) => `${title} — ${action}`,
    /** aria-label suffix for external links */
    externalSuffix: (action: string) => `${action} (externe link)`,
  },

  // ---- Filters ----
  filters: {
    title: "Filters",
    item: "item",
    items: "items",
    clear: "Wissen",
    province: "Provincie",
    allProvinces: "Alle provincies",
    from: "Van",
    to: "Tot",
    csnMembersOnly: "Alleen CSN-leden",
    bcfMembersOnly: "Alleen BCF-leden",
  },

  // ---- Map: tooltips, popups, controls ----
  map: {
    resetView: "Hele kaart",
    resetViewAria: "Toon de hele kaart",
    clusterItems: (count: number) => `${count} items`,
    openGymLocation: "Open gym locatie",
    openGym: "Open gym",
    toWebsite: "Naar de website",
    moreInfo: "Meer info",
    viewClubPage: "Bekijk clubpagina",
    /** "vanaf 15 jun" for an open-ended coach stay (short, map popup) */
    fromDate: (date: string) => `Vanaf ${date}`,
    /** aria-label: "<club> op <network>" */
    clubVia: (name: string, network: string) => `${name} op ${network}`,
    /** aria-label: "<coach> via <network>" */
    coachVia: (name: string, network: string) => `${name} via ${network}`,
  },

  // ---- Clubs directory ----
  clubs: {
    metaTitle: "Clubgids",
    metaDescription:
      "Alle cheerleadingclubs: zoek op naam of plaats en filter op niveau, divisie en leeftijdscategorie.",
    heading: "Clubgids",
    intro:
      "Vind cheerleadingclubs. Zoek op naam of plaats en filter op niveau, divisie en leeftijdscategorie.",
    searchPlaceholder: "Zoek op clubnaam of plaats…",
    searchAria: "Zoek clubs",
    filter: "Filter",
    level: "Niveau",
    type: "Type",
    division: "Divisie",
    age: "Leeftijd",
    province: "Provincie",
    clear: "Wissen",
    /** dropdown "all" option, e.g. "Niveau: alle" */
    filterAll: (label: string) => `${label}: alle`,
    one: "club",
    many: "clubs",
    /** " van <total>" suffix when a filter is narrowing results */
    ofTotal: (total: number) => ` van ${total}`,
    emptyNoneTitle: "Nog geen clubs bekend",
    emptyNoneHint: "Zodra clubs zijn toegevoegd verschijnen ze hier.",
    emptyFilteredTitle: "Geen clubs gevonden",
    emptyFilteredHint: "Pas je zoekopdracht of filters aan.",
    noTeams: "Nog geen teams bekend",
    csnMember: "CSN-lid",
    /** tooltip/aria for the CSN member badge */
    csnMemberAria: "Lid van Cheersport Nederland",
    csnMembersOnly: "Alleen CSN-leden",
    bcfMember: "BCF-lid",
    /** tooltip/aria for the BCF member badge */
    bcfMemberAria: "Lid van de Belgian Cheerleading Federation",
    bcfMembersOnly: "Alleen BCF-leden",
  },

  // ---- Club profile ----
  club: {
    notFoundTitle: "Club niet gevonden",
    /** metadata description fallback when a club has no blurb */
    metaFallback: (name: string, city: string | null) =>
      `Cheerleadingclub ${name}${city ? ` uit ${city}` : ""}: teams, evenementen en open gyms.`,
    backToClubs: "← Terug naar clubgids",
    /** "Opgericht in 2018" */
    founded: (year: number) => `Opgericht in ${year}`,
    sectionTeams: "Teams",
    sectionTrainingTimes: "Trainingstijden",
    sectionCoaches: "Coaches",
    sectionAchievements: "Prestaties",
    sectionUpcoming: "Aankomende evenementen",
    sectionOpenGyms: "Open gyms",
    practical: "Praktisch",
    trainingLocation: "Trainingslocatie",
    address: "Adres",
    contact: "Contact",
    noPractical: "Praktische gegevens nog niet bekend",
    viewOnMap: "Bekijk op de kaart",
    emptyEventsTitle: "Nog geen evenementen bekend",
    emptyEventsHint:
      "Aankomende wedstrijden en workshops verschijnen hier zodra ze bekend zijn.",
    emptyOpenGymsTitle: "Nog geen open gyms bekend",
    emptyOpenGymsHint:
      "Terugkerende open-gym tijden verschijnen hier zodra ze bekend zijn.",
    emptyTrainingTitle: "Nog geen trainingstijden bekend",
    emptyTrainingHint:
      "Wekelijkse trainingsmomenten per team verschijnen hier zodra ze bekend zijn.",
    /** group label for trainings with no team name */
    otherTeam: "Overig",
    /** "Elke zaterdag" recurring-slot prefix */
    every: (weekday: string) => `Elke ${weekday.toLowerCase()}`,
    /** Badge shown next to a coach with a valid ICU certification */
    icuCertified: "ICU-gecertificeerd",
    /** Open-gym price label when the session is free */
    openGymFree: "Gratis",
  },

  // ---- Coaches directory ----
  coaches: {
    metaTitle: "Coaches",
    metaDescription:
      "Coaches van cheerleadingclubs en gast-/touring-coaches op bezoek: zie wie waar coacht en neem direct contact op.",
    heading: "Gastcoaches",
    introBefore:
      "Coaches van clubs, plus gast- en touring-coaches op bezoek. Zelf op bezoek?",
    introLink: "Meld je verblijf aan",
    emptyTitle: "Nog geen gastcoaches",
    emptyHint:
      "Zodra een gastcoach zijn verblijf aanmeldt en het is goedgekeurd, verschijnt die hier.",
    /** "Vanaf 15 jun 2026" for an open-ended stay (coach card, long form) */
    fromDate: (date: string) => `Vanaf ${date}`,
    /** Page H1 — now covers club coaches + visiting coaches */
    pageHeading: "Coaches",
    /** Section heading for the per-club coaching staff (primary section) */
    clubCoachesHeading: "Clubcoaches",
    /** Section heading for visiting/touring coaches (secondary section) */
    visitingHeading: "Gastcoaches",
    /** Club-level badge: this club has at least one ICU-certified coach */
    clubHasIcuCoach: "Heeft ICU-coach",
  },

  // ---- Submit page + form ----
  submit: {
    metaTitle: "Inzenden · Cheer Overview",
    metaDescription:
      "Mis je een evenement, open gym of club? Stuur het in. Wij controleren elke inzending voordat die online komt.",
    heading: "Iets inzenden",
    intro:
      "Mis je een wedstrijd, open gym of club op de kaart? Of klopt er iets niet? Stuur het hieronder in. We bekijken elke inzending handmatig voordat die online komt — zo houden we de agenda betrouwbaar.",
    signInIntro:
      "Om spam tegen te gaan vragen we je om in te loggen voordat je iets inzendt. Je gegevens worden alleen gebruikt om je inzending te verifiëren.",
    signInButton: "Inloggen met Google om iets te melden of aan te vullen",
    signInError: "Inloggen met Google is mislukt. Probeer het opnieuw.",
    successTitle: "Bedankt! We bekijken je inzending.",
    successBody:
      "Zodra een redacteur je inzending heeft bekeken, verschijnt die op de site.",
    successAgain: "Nog iets inzenden",
    signedInAs: "Ingelogd als",
    signOut: "Uitloggen",
    kindLegend: "Waar gaat het over?",
    messageLabel: "Wat wil je ons laten weten?",
    emailLabel: "Je e-mailadres (optioneel)",
    emailHint: "Alleen als we een vraag over je inzending hebben.",
    submitting: "Versturen…",
    submit: "Inzenden",
    reviewNote: "We bekijken elke inzending vóór publicatie.",
    honeypotLabel: "Laat dit veld leeg",
    notSignedInError: "Log in met Google om iets te melden of aan te vullen.",
    genericError: "Er ging iets mis. Probeer het opnieuw.",
    networkError: "Kon de inzending niet versturen. Controleer je verbinding.",
    // Kind labels (also used in the review queue).
    kindLabel: {
      event: "Evenement",
      gym: "Open gym",
      club: "Club",
      coach: "Gastcoach (op bezoek)",
      correction: "Ontbrekende of onjuiste info",
      feedback: "Feedback",
    } satisfies Record<SubmissionKind, string>,
    kindHelp: {
      event: "Een wedstrijd, workshop, tryout, showcase of andere activiteit.",
      gym: "Een terugkerend open-gym moment bij een club.",
      club: "Een club, studententeam, schoolteam of selectieteam dat nog niet op de kaart staat.",
      coach:
        "Ben je een (gast)coach die ons land bezoekt? Vertel waar en wanneer je bent en hoe mensen je kunnen bereiken.",
      correction: "Er klopt iets niet of er ontbreekt iets.",
      feedback: "Een idee, opmerking of probleem met de site zelf.",
    } satisfies Record<SubmissionKind, string>,
    kindPlaceholder: {
      event:
        "bv. Open NK Cheerleading op 31 mei 2026 in Sporthallen Zuid Amsterdam, georganiseerd door … — link of tickets erbij als je die hebt.",
      gym: "bv. Cheer Amsterdam heeft elke woensdag 19:00–21:00 open gym in sporthal …",
      club: "bv. Naam, plaats, en een website of Instagram. Alles wat je weet helpt.",
      coach:
        "bv. Coach Jamie (tumbling) is 12–20 juni in Utrecht, te boeken via @handle of jij@voorbeeld.nl.",
      correction:
        "bv. Het adres van club X klopt niet, of team Y traint niet meer op dinsdag.",
      feedback: "Vertel ons wat beter kan, of wat je opviel op de site.",
    } satisfies Record<SubmissionKind, string>,
    kindUrl: {
      event: {
        label: "Link (optioneel)",
        hint: "Een website, ticketpagina of Instagram die helpt.",
      },
      gym: {
        label: "Link (optioneel)",
        hint: "Een website of Instagram van de club.",
      },
      club: {
        label: "Link (optioneel)",
        hint: "Website of Instagram van de club.",
      },
      coach: {
        label: "Link (optioneel)",
        hint: "Je website, Instagram of boekingspagina.",
      },
      correction: {
        label: "Relevante link (optioneel)",
        hint: "Plak de pagina of link die hoort bij wat ontbreekt of niet klopt. Meer dan één? Zet de rest ook in je bericht.",
      },
      feedback: {
        label: "Link (optioneel)",
        hint: "Een pagina of screenshot-link die helpt.",
      },
    } satisfies Record<SubmissionKind, { label: string; hint: string }>,
  },

  // ---- Submission validation messages (zod) ----
  validation: {
    urlTooLong: "URL is te lang",
    urlInvalid: "Voer een geldige URL in (incl. https://)",
    emailInvalid: "Voer een geldig e-mailadres in",
    messageTooShort: "Vertel ons iets meer (minstens 5 tekens)",
    messageTooLong: "Dat is wel heel lang — kort het iets in",
  },

  // ---- Admin / review queue ----
  admin: {
    loadingTitle: "Review queue",
    signInHeading: "Beheer",
    signInIntro: "Log in met Google om inzendingen te beoordelen.",
    signInError: "Inloggen met Google is mislukt. Probeer het opnieuw.",
    signInButton: "Inloggen met Google",
    signOut: "Uitloggen",
    columnUndecided: "Onbeslist",
    columnAgreed: "Akkoord",
    columnDisagreed: "Oneens",
    refresh: "Vernieuwen",
    retry: "Opnieuw proberen",
    /** "<n> items · <m> beslist" */
    counts: (total: number, decided: number) =>
      `${total} items · ${decided} beslist`,
    nothingToReview: "Niets te beoordelen.",
    loadError: "Kon items niet laden.",
    networkError: "Netwerkfout. Probeer opnieuw.",
    forbiddenTitle: "Geen toegang met dit account",
    forbiddenBody:
      "Dit Google-account is geen beheerder. Log uit en probeer een ander account.",
    badgeSubmission: "Inzending",
    badgeEvent: "Event",
    eventFallbackTitle: "Event",
    noFields: "(geen velden)",
    showMore: "Toon meer",
    showLess: "Toon minder",
    notePlaceholder: "Notitie (optioneel)…",
    noteDirty: "Niet opgeslagen — klik buiten het veld",
    noteSaving: "Opslaan…",
    noteSaved: "Opgeslagen ✓",
    noteError: "Opslaan mislukt",
    /** "Inzending · <when>" */
    submissionMeta: (when: string) => `Inzending · ${when}`,
    /** "Gescraped · <type> · <when>" */
    scrapedMeta: (type: string, when: string) =>
      `Gescraped · ${type} · ${when}`,
    payload: {
      title: "titel",
      type: "type",
      start: "start",
      location: "locatie",
      url: "url",
      description: "omschrijving",
    },
  },

  // ---- About page ----
  about: {
    metaTitle: "Over Cheer Overview",
    metaDescription:
      "Cheer Overview brengt alle cheerleading samen op één plek: clubs, wedstrijden, open gyms en trainingstijden op een kaart, agenda en clubgids.",
    eyebrow: "Over dit project",
    heading: "Alle cheerleading, op één plek",
    introBefore:
      "Cheer Overview brengt de cheerleadingwereld samen op één plek: clubs, wedstrijden, open gyms en trainingstijden, op een kaart, agenda en clubgids. Ik heb het gemaakt omdat die informatie nu verspreid staat over clubsites, socials en federatie-agenda's.",
    whatHeading: "Wat ik bouw",
    whatBody:
      "Informatie over cheerleading staat nu verspreid over losse clubsites, social media en federatie-agenda's. Ik breng het samen. Data wordt grotendeels automatisch verzameld en aangevuld met meldingen uit de community. Elke onzekere of gemelde toevoeging controleer ik handmatig voordat die online komt.",
    chipMap: "Kaart",
    chipAgenda: "Agenda",
    chipClubs: "Clubgids",
    builtBy: "Gemaakt door",
    roadmapHeading: "Roadmap",
    roadmapIntro:
      "Waar Cheer Overview naartoe groeit: naar de bredere regio, zodat uiteindelijk de hele scene op één kaart komt.",
    roadmap: {
      belgiumTitle: "België",
      belgiumBody:
        "Clubs, wedstrijden en open gyms uit België staan nu op de kaart — de Lage Landen samen op één overzicht.",
      belgiumWhen: "Live",
      rulesAiTitle: "Regels-assistent",
      rulesAiWhen: "Later",
      coachesTitle: "Uitgebreidere coachespagina",
      coachesBody:
        "De bestaande coachespagina verder uitbouwen voor de coaches die al bij clubs trainen: rijkere profielen met specialisaties en bij welke club ze coachen, zodat je makkelijker de juiste coach vindt.",
      coachesWhen: "Later",
    },
    csnHeading: "Over Cheersport Netherlands",
    csnBody1:
      "Cheersport Netherlands (CSN) is de nationale cheerleadingfederatie van Nederland, gevestigd in Maastricht. Samen met coaches, sporters, scholen en clubs laat CSN cheerleading groeien vanuit samenwerking, opleiding en inclusiviteit.",
    csnVisit: "Bezoek cheersport.nl",
    tcnlHeading: "Over Team Cheerleading Nederland",
    tcnlBody1:
      "Stichting Team Cheerleading Nederland (TCNL) staat achter de nationale teams (de Dutch Equipe) die Nederland vertegenwoordigen op internationale wedstrijden zoals de ICU World Championships. Aangesteld door CSN en volledig gedragen door vrijwilligers, regelt TCNL de trainingen, coaches, kleding, reizen en sponsoring. Team Cheer NL komt uit in Coed, All Girl, Junior, Youth en Adaptive Abilities.",
    tcnlVisit: "Bezoek teamcheerleading.nl",
    tbHeading: "Over Team Belgium",
    tbBody1:
      "Team Belgium is het nationale-teamprogramma van de Belgian Cheerleading Federation (BCF), de Belgische cheerleadingfederatie en ICU-lid, gevestigd in Leuven. Bij de allereerste deelname aan de ICU World Championships (Orlando, april 2025) pakte Team Belgium meteen goud in All Girl Elite en zilver in Coed Elite.",
    tbVisit: "Bezoek belgiancheer.be",
    ctaHeading: "Mis je iets?",
    ctaBody:
      "De agenda groeit met de community. Ontbreekt er een club, wedstrijd of open gym? Laat het ons weten.",
    ctaButton: "Ontbrekend item melden",
  },

  // ---- Privacy page ----
  // ---- Analytics consent ----
  consent: {
    title: "Cookiemelding",
    body: "We gebruiken statistieken om te zien hoe de site gebruikt wordt. Alleen met jouw toestemming, en nooit voor advertenties.",
    privacyLink: "Lees onze privacyverklaring",
    accept: "Akkoord",
    decline: "Weigeren",
  },

  privacy: {
    metaTitle: "Privacy",
    metaDescription:
      "Privacyverklaring van Cheer Overview: welke gegevens we tonen en hoe we ermee omgaan.",
    heading: "Privacy",
    lastUpdated: "Laatst bijgewerkt: juni 2026",
    whatHeading: "Wat dit is",
    whatBody:
      "Cheer Overview is een open overzicht van cheerleading: clubs, wedstrijden, open gyms en trainingstijden. We verzamelen en tonen publiek beschikbare informatie over clubs en evenementen.",
    dataHeading: "Welke gegevens",
    dataBody:
      "De getoonde clubgegevens (naam, locatie, teams, contactgegevens, social media) komen uit openbare bronnen of zijn door clubs zelf aangeleverd. We slaan geen persoonlijke accountgegevens van bezoekers op en gebruiken nooit gegevens voor advertenties.",
    analyticsHeading: "Statistieken",
    analyticsBody:
      "Als je daar toestemming voor geeft, gebruiken we Google Analytics om te zien hoe de site gebruikt wordt: welke pagina's bezocht worden en hoeveel bezoekers er zijn. Je IP-adres wordt daarbij ingekort. Zonder jouw toestemming wordt er niets geladen en niets gemeten. Wil je je keuze wijzigen? Wis de opslag van deze site in je browser; dan vragen we het opnieuw.",
    contributeHeading: "Bijdragen",
    contributeBody:
      "Wanneer je via het bijdrageformulier informatie aanlevert, gebruiken we die uitsluitend om het overzicht aan te vullen en te controleren.",
    correctionsHeading: "Correcties",
    correctionsBody:
      "Klopt er iets niet of wil je dat gegevens worden aangepast of verwijderd? Laat het ons weten via het bijdrageformulier, dan passen we het aan.",
  },

  // ---- 404 ----
  notFound: {
    title: "Pagina niet gevonden",
    body: "Deze pagina bestaat niet (meer). Misschien is de link verouderd of is er een typefout geslopen.",
    backHome: "Terug naar de kaart",
  },

  // ---- Root metadata ----
  meta: {
    defaultTitle: "Cheer Overview: alle cheerleading op één plek",
    description:
      "Eén overzicht van alle cheerleadingclubs, wedstrijden, open gyms en trainingstijden. Kaart, kalender en clubgids.",
  },
};

/**
 * The dictionary shape, inferred from the canonical Dutch dictionary. `nl` has
 * no `as const`, so string values infer as `string` (not literal types) — this
 * lets `en` supply different strings while still being checked for the SAME set
 * of keys and value types. A missing/extra/mistyped key in `en` is a compile
 * error via `satisfies Dictionary`.
 */
export type Dictionary = typeof nl;

/** The English dictionary — must structurally match `nl` (compile-checked). */
export const en = {
  header: {
    nav: {
      home: "Map & agenda",
      clubs: "Clubs",
      coaches: "Coaches",
      about: "About",
      admin: "Admin",
    },
    submitCta: "Report a missing item",
    skipToContent: "Skip to content",
    csnLogoAlt: "Cheersport Netherlands",
  },
  footer: {
    tagline: "Cheer Overview, an open overview of cheerleading.",
    about: "About",
    contribute: "Contribute",
    privacy: "Privacy",
    builtBy: "Built by",
    csnLogoAlt: "Cheersport Netherlands",
  },
  language: {
    label: "Language",
    nl: "NL",
    en: "EN",
    fr: "FR",
    nlFull: "Dutch",
    enFull: "English",
    frFull: "French",
    switchTo: (full: string) => `Switch to ${full}`,
  },

  eventType: {
    competition: "Competition",
    open_gym: "Open gym",
    workshop: "Workshop",
    tryout: "Tryout",
    showcase: "Showcase",
    other: "Other",
  },

  // Numeric L-code keys; labels show the ICU word-name (CSN/NK convention).
  level: {
    "1": "Novice (L1)",
    "2": "Intermediate (L2)",
    "3": "Median (L3)",
    "4": "Advanced (L4)",
    "5": "Elite (L5)",
    "6": "Premier (L6)",
    "7": "Premier (L7)",
  },
  discipline: {
    cheer: "Cheer",
    performance_cheer: "Performance Cheer",
  },
  danceStyle: {
    pom: "Pom",
    hip_hop: "Hip Hop",
    jazz: "Jazz",
    kick: "Kick",
    pom_doubles: "Pom Doubles",
    hip_hop_doubles: "Hip Hop Doubles",
  },
  tier: {
    competition: "Competition",
    prep: "Prep",
    recreational: "Recreational",
  },
  division: {
    all_girl: "All Girl",
    coed: "Coed",
    all_boy: "All Boy",
  },
  ageGroup: {
    mini: "Mini",
    youth: "Youth",
    junior: "Junior",
    senior: "Senior",
    open: "Open",
  },

  weekdays: [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ],

  home: {
    mobileTab: { map: "Map", agenda: "Agenda" },
    mapAriaLabel: "Map of cheerleading clubs",
    agendaAriaLabel: "Agenda of events",
    emptyMap: {
      title: "No clubs on the map yet",
      hint: "Once clubs with a location are added, they will appear here as pins.",
    },
    emptyAgenda: {
      title: "No events yet",
      hint: "Competitions, open gyms and workshops will appear here as they are announced.",
    },
  },

  agenda: {
    today: "Today",
    tomorrow: "Tomorrow",
    allDay: "All day",
    until: "until",
    emptyTitle: "No events",
    emptyHint: "No events in this period or matching these filters.",
    viewClub: "View club",
    viewCoach: "View coach",
    moreInfo: "More info",
    website: "Website",
    showOnMap: (title: string) => `${title} — show location on the map`,
    rowLink: (title: string, action: string) => `${title} — ${action}`,
    externalSuffix: (action: string) => `${action} (external link)`,
  },

  filters: {
    title: "Filters",
    item: "item",
    items: "items",
    clear: "Clear",
    province: "Province",
    allProvinces: "All provinces",
    from: "From",
    to: "To",
    csnMembersOnly: "CSN members only",
    bcfMembersOnly: "BCF members only",
  },

  map: {
    resetView: "Whole map",
    resetViewAria: "Show the whole map",
    clusterItems: (count: number) => `${count} items`,
    openGymLocation: "Open gym location",
    openGym: "Open gym",
    toWebsite: "Go to website",
    moreInfo: "More info",
    viewClubPage: "View club page",
    fromDate: (date: string) => `From ${date}`,
    clubVia: (name: string, network: string) => `${name} on ${network}`,
    coachVia: (name: string, network: string) => `${name} via ${network}`,
  },

  clubs: {
    metaTitle: "Club directory",
    metaDescription:
      "All cheerleading clubs: search by name or city and filter by level, division and age group.",
    heading: "Club directory",
    intro:
      "Find cheerleading clubs. Search by name or city and filter by level, division and age group.",
    searchPlaceholder: "Search by club name or city…",
    searchAria: "Search clubs",
    filter: "Filter",
    level: "Level",
    type: "Type",
    division: "Division",
    age: "Age",
    province: "Province",
    clear: "Clear",
    filterAll: (label: string) => `${label}: all`,
    one: "club",
    many: "clubs",
    ofTotal: (total: number) => ` of ${total}`,
    emptyNoneTitle: "No clubs yet",
    emptyNoneHint: "Once clubs are added they will appear here.",
    emptyFilteredTitle: "No clubs found",
    emptyFilteredHint: "Adjust your search or filters.",
    noTeams: "No teams listed yet",
    csnMember: "CSN member",
    /** tooltip/aria for the CSN member badge */
    csnMemberAria: "Member of Cheersport Netherlands",
    csnMembersOnly: "CSN members only",
    bcfMember: "BCF member",
    /** tooltip/aria for the BCF member badge */
    bcfMemberAria: "Member of the Belgian Cheerleading Federation",
    bcfMembersOnly: "BCF members only",
  },

  club: {
    notFoundTitle: "Club not found",
    metaFallback: (name: string, city: string | null) =>
      `Cheerleading club ${name}${city ? ` from ${city}` : ""}: teams, events and open gyms.`,
    backToClubs: "← Back to club directory",
    founded: (year: number) => `Founded in ${year}`,
    sectionTeams: "Teams",
    sectionTrainingTimes: "Training times",
    sectionCoaches: "Coaches",
    sectionAchievements: "Achievements",
    sectionUpcoming: "Upcoming events",
    sectionOpenGyms: "Open gyms",
    practical: "Practical info",
    trainingLocation: "Training location",
    address: "Address",
    contact: "Contact",
    noPractical: "Practical details not known yet",
    viewOnMap: "View on the map",
    emptyEventsTitle: "No events yet",
    emptyEventsHint:
      "Upcoming competitions and workshops will appear here as they are announced.",
    emptyOpenGymsTitle: "No open gyms yet",
    emptyOpenGymsHint:
      "Recurring open-gym times will appear here as they are announced.",
    emptyTrainingTitle: "No training times yet",
    emptyTrainingHint:
      "Weekly per-team training times will appear here as they are announced.",
    otherTeam: "Other",
    every: (weekday: string) => `Every ${weekday.toLowerCase()}`,
    icuCertified: "ICU certified",
    openGymFree: "Free",
  },

  coaches: {
    metaTitle: "Coaches",
    metaDescription:
      "Coaches at cheerleading clubs plus guest/touring coaches visiting: see who coaches where, and get in touch directly.",
    heading: "Visiting coaches",
    introBefore:
      "Coaches at clubs, plus guest and touring coaches visiting. Visiting yourself?",
    introLink: "Submit your stay",
    emptyTitle: "No visiting coaches yet",
    emptyHint:
      "Once a guest coach submits their stay and it's approved, they'll appear here.",
    fromDate: (date: string) => `From ${date}`,
    pageHeading: "Coaches",
    clubCoachesHeading: "Club coaches",
    visitingHeading: "Visiting coaches",
    clubHasIcuCoach: "Has an ICU coach",
  },

  submit: {
    metaTitle: "Submit · Cheer Overview",
    metaDescription:
      "Missing an event, open gym or club? Send it in. We review every submission before it goes live.",
    heading: "Submit something",
    intro:
      "Missing a competition, open gym or club on the map? Or is something wrong? Send it in below. We review every submission by hand before it goes live — that keeps the agenda reliable.",
    signInIntro:
      "To prevent spam, we ask you to sign in before submitting. Your details are only used to verify your submission.",
    signInButton: "Sign in with Google to report or add something",
    signInError: "Google sign-in failed. Please try again.",
    successTitle: "Thanks! We're reviewing your submission.",
    successBody:
      "Once an editor has reviewed your submission, it will appear on the site.",
    successAgain: "Submit something else",
    signedInAs: "Signed in as",
    signOut: "Sign out",
    kindLegend: "What is it about?",
    messageLabel: "What would you like to tell us?",
    emailLabel: "Your email address (optional)",
    emailHint: "Only if we have a question about your submission.",
    submitting: "Sending…",
    submit: "Submit",
    reviewNote: "We review every submission before publishing.",
    honeypotLabel: "Leave this field empty",
    notSignedInError: "Sign in with Google to report or add something.",
    genericError: "Something went wrong. Please try again.",
    networkError: "Could not send your submission. Check your connection.",
    kindLabel: {
      event: "Event",
      gym: "Open gym",
      club: "Club",
      coach: "Visiting coach",
      correction: "Missing or incorrect info",
      feedback: "Feedback",
    },
    kindHelp: {
      event: "A competition, workshop, tryout, showcase or other activity.",
      gym: "A recurring open-gym session at a club.",
      club: "A club, student team, school team or select team that's not on the map yet.",
      coach:
        "Are you a (visiting) coach touring the country? Tell us where and when you are and how people can reach you.",
      correction: "Something is wrong or something is missing.",
      feedback: "An idea, comment or issue with the site itself.",
    },
    kindPlaceholder: {
      event:
        "e.g. Open NK Cheerleading on 31 May 2026 at Sporthallen Zuid Amsterdam, organized by … — add a link or tickets if you have them.",
      gym: "e.g. Cheer Amsterdam has open gym every Wednesday 19:00–21:00 at sports hall …",
      club: "e.g. Name, city, and a website or Instagram. Anything you know helps.",
      coach:
        "e.g. Coach Jamie (tumbling) is in Utrecht 12–20 June, bookable via @handle or you@example.com.",
      correction:
        "e.g. The address of club X is wrong, or team Y no longer trains on Tuesdays.",
      feedback:
        "Tell us what could be better, or what you noticed on the site.",
    },
    kindUrl: {
      event: {
        label: "Link (optional)",
        hint: "A website, ticket page or Instagram that helps.",
      },
      gym: {
        label: "Link (optional)",
        hint: "A website or Instagram of the club.",
      },
      club: {
        label: "Link (optional)",
        hint: "Website or Instagram of the club.",
      },
      coach: {
        label: "Link (optional)",
        hint: "Your website, Instagram or booking page.",
      },
      correction: {
        label: "Relevant link (optional)",
        hint: "Paste the page or link related to what's missing or wrong. More than one? Add the rest to your message.",
      },
      feedback: {
        label: "Link (optional)",
        hint: "A page or screenshot link that helps.",
      },
    },
  },

  validation: {
    urlTooLong: "URL is too long",
    urlInvalid: "Enter a valid URL (incl. https://)",
    emailInvalid: "Enter a valid email address",
    messageTooShort: "Tell us a bit more (at least 5 characters)",
    messageTooLong: "That's very long — please shorten it a little",
  },

  admin: {
    loadingTitle: "Review queue",
    signInHeading: "Admin",
    signInIntro: "Sign in with Google to review submissions.",
    signInError: "Google sign-in failed. Please try again.",
    signInButton: "Sign in with Google",
    signOut: "Sign out",
    columnUndecided: "Undecided",
    columnAgreed: "Agreed",
    columnDisagreed: "Disagreed",
    refresh: "Refresh",
    retry: "Try again",
    counts: (total: number, decided: number) =>
      `${total} items · ${decided} decided`,
    nothingToReview: "Nothing to review.",
    loadError: "Could not load items.",
    networkError: "Network error. Please try again.",
    forbiddenTitle: "No access with this account",
    forbiddenBody:
      "This Google account is not an admin. Sign out and try another account.",
    badgeSubmission: "Submission",
    badgeEvent: "Event",
    eventFallbackTitle: "Event",
    noFields: "(no fields)",
    showMore: "Show more",
    showLess: "Show less",
    notePlaceholder: "Note (optional)…",
    noteDirty: "Not saved — click outside the field",
    noteSaving: "Saving…",
    noteSaved: "Saved ✓",
    noteError: "Save failed",
    submissionMeta: (when: string) => `Submission · ${when}`,
    scrapedMeta: (type: string, when: string) => `Scraped · ${type} · ${when}`,
    payload: {
      title: "title",
      type: "type",
      start: "start",
      location: "location",
      url: "url",
      description: "description",
    },
  },

  about: {
    metaTitle: "About Cheer Overview",
    metaDescription:
      "Cheer Overview brings all cheerleading together in one place: clubs, competitions, open gyms and training times on a map, agenda and club directory.",
    eyebrow: "About this project",
    heading: "All cheerleading, in one place",
    introBefore:
      "Cheer Overview brings the cheerleading world together in one place: clubs, competitions, open gyms and training times, on a map, agenda and club directory. I built it because that information is currently scattered across club sites, socials and federation calendars.",
    whatHeading: "What I'm building",
    whatBody:
      "Information about cheerleading is currently scattered across separate club sites, social media and federation calendars. I bring it together. Data is mostly collected automatically and supplemented with reports from the community. Every uncertain or reported addition I check by hand before it goes live.",
    chipMap: "Map",
    chipAgenda: "Agenda",
    chipClubs: "Club directory",
    builtBy: "Built by",
    roadmapHeading: "Roadmap",
    roadmapIntro:
      "Where Cheer Overview is heading: to the wider region, so that eventually the whole scene is on one map.",
    roadmap: {
      belgiumTitle: "Belgium",
      belgiumBody:
        "Clubs, competitions and open gyms from Belgium are now on the map — the Low Countries on one overview.",
      belgiumWhen: "Live",
      rulesAiTitle: "Ask-the-rules assistant",
      rulesAiWhen: "Later",
      coachesTitle: "Expanded coaches page",
      coachesBody:
        "Building out the existing coaches page for the coaches already training at clubs: richer profiles with specialisms and which club they coach at, so you can find the right coach more easily.",
      coachesWhen: "Later",
    },
    csnHeading: "About Cheersport Netherlands",
    csnBody1:
      "Cheersport Netherlands (CSN) is the national cheerleading federation of the Netherlands, based in Maastricht. Together with coaches, athletes, schools and clubs, it grows the sport from a vision of collaboration, education and inclusivity.",
    csnVisit: "Visit cheersport.nl",
    tcnlHeading: "About Team Cheerleading Nederland",
    tcnlBody1:
      "Stichting Team Cheerleading Nederland (TCNL) is the body behind the national teams (the Dutch Equipe) that represent the country at international competitions such as the ICU World Championships. Appointed by CSN and run entirely by volunteers, it handles the training, coaching, apparel, travel and sponsorship. Team Cheer NL competes in Coed, All Girl, Junior, Youth and Adaptive Abilities.",
    tcnlVisit: "Visit teamcheerleading.nl",
    tbHeading: "About Team Belgium",
    tbBody1:
      "Team Belgium is the national-team programme of the Belgian Cheerleading Federation (BCF), Belgium's cheerleading federation and ICU member, based in Leuven. At its very first ICU World Championships (Orlando, April 2025), Team Belgium took gold in All Girl Elite and silver in Coed Elite.",
    tbVisit: "Visit belgiancheer.be",
    ctaHeading: "Missing something?",
    ctaBody:
      "The agenda grows with the community. Missing a club, competition or open gym? Let us know.",
    ctaButton: "Report a missing item",
  },

  // ---- Analytics consent ----
  consent: {
    title: "Cookie notice",
    body: "We use analytics to see how the site is used. Only with your consent, and never for advertising.",
    privacyLink: "Read our privacy statement",
    accept: "Accept",
    decline: "Decline",
  },

  privacy: {
    metaTitle: "Privacy",
    metaDescription:
      "Cheer Overview privacy statement: what data we show and how we handle it.",
    heading: "Privacy",
    lastUpdated: "Last updated: June 2026",
    whatHeading: "What this is",
    whatBody:
      "Cheer Overview is an open overview of cheerleading: clubs, competitions, open gyms and training times. We collect and show publicly available information about clubs and events.",
    dataHeading: "What data",
    dataBody:
      "The club details shown (name, location, teams, contact details, social media) come from public sources or are supplied by clubs themselves. We do not store personal visitor account data and do not use tracking cookies for advertising.",
    analyticsHeading: "Analytics",
    analyticsBody:
      "If you consent, we use Google Analytics to see how the site is used: which pages are visited and how many visitors there are. Your IP address is truncated. Without your consent nothing is loaded and nothing is measured. Want to change your choice? Clear this site's storage in your browser and we'll ask again.",
    contributeHeading: "Contributing",
    contributeBody:
      "When you supply information via the contribution form, we use it only to complete and verify the overview.",
    correctionsHeading: "Corrections",
    correctionsBody:
      "Is something wrong, or would you like data changed or removed? Let us know via the contribution form and we'll update it.",
  },

  notFound: {
    title: "Page not found",
    body: "This page doesn't exist (anymore). The link may be outdated or contain a typo.",
    backHome: "Back to the map",
  },

  meta: {
    defaultTitle: "Cheer Overview: all cheerleading in one place",
    description:
      "One overview of all cheerleading clubs, competitions, open gyms and training times. Map, calendar and club directory.",
  },
} satisfies Dictionary;

/** The French dictionary — must structurally match `nl` (compile-checked). */
export const fr = {
  header: {
    nav: {
      home: "Carte & agenda",
      clubs: "Clubs",
      coaches: "Coaches",
      about: "À propos",
      admin: "Admin",
    },
    submitCta: "Signaler un élément manquant",
    skipToContent: "Aller au contenu",
    csnLogoAlt: "Cheersport Nederland",
  },
  footer: {
    tagline: "Cheer Overview, un aperçu ouvert du cheerleading.",
    about: "À propos",
    contribute: "Contribuer",
    privacy: "Confidentialité",
    builtBy: "Créé par",
    csnLogoAlt: "Cheersport Nederland",
  },
  language: {
    label: "Langue",
    nl: "NL",
    en: "EN",
    fr: "FR",
    nlFull: "Néerlandais",
    enFull: "Anglais",
    frFull: "Français",
    switchTo: (full: string) => `Passer en ${full.toLowerCase()}`,
  },

  eventType: {
    competition: "Compétition",
    open_gym: "Open gym",
    workshop: "Workshop",
    tryout: "Tryout",
    showcase: "Showcase",
    other: "Autre",
  },

  // Numeric L-code keys; labels show the ICU word-name (CSN/NK convention).
  level: {
    "1": "Novice (L1)",
    "2": "Intermediate (L2)",
    "3": "Median (L3)",
    "4": "Advanced (L4)",
    "5": "Elite (L5)",
    "6": "Premier (L6)",
    "7": "Premier (L7)",
  },
  discipline: {
    cheer: "Cheer",
    performance_cheer: "Performance Cheer",
  },
  danceStyle: {
    pom: "Pom",
    hip_hop: "Hip Hop",
    jazz: "Jazz",
    kick: "Kick",
    pom_doubles: "Pom Doubles",
    hip_hop_doubles: "Hip Hop Doubles",
  },
  tier: {
    competition: "Compétition",
    prep: "Prep",
    recreational: "Loisir",
  },
  division: {
    all_girl: "All Girl",
    coed: "Coed",
    all_boy: "All Boy",
  },
  ageGroup: {
    mini: "Mini",
    youth: "Youth",
    junior: "Junior",
    senior: "Senior",
    open: "Open",
  },

  weekdays: [
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
    "Dimanche",
  ],

  home: {
    mobileTab: { map: "Carte", agenda: "Agenda" },
    mapAriaLabel: "Carte des clubs de cheerleading",
    agendaAriaLabel: "Agenda des événements",
    emptyMap: {
      title: "Pas encore de clubs sur la carte",
      hint: "Dès que des clubs avec une localisation seront ajoutés, ils apparaîtront ici sous forme d'épingles.",
    },
    emptyAgenda: {
      title: "Pas encore d'événements",
      hint: "Les compétitions, open gyms et workshops apparaîtront ici dès qu'ils seront annoncés.",
    },
  },

  agenda: {
    today: "Aujourd'hui",
    tomorrow: "Demain",
    allDay: "Toute la journée",
    until: "jusqu'à",
    emptyTitle: "Aucun événement",
    emptyHint: "Aucun événement sur cette période ou avec ces filtres.",
    viewClub: "Voir le club",
    viewCoach: "Voir le coach",
    moreInfo: "Plus d'infos",
    website: "Site web",
    showOnMap: (title: string) => `${title} — afficher le lieu sur la carte`,
    rowLink: (title: string, action: string) => `${title} — ${action}`,
    externalSuffix: (action: string) => `${action} (lien externe)`,
  },

  filters: {
    title: "Filtres",
    item: "élément",
    items: "éléments",
    clear: "Effacer",
    province: "Province",
    allProvinces: "Toutes les provinces",
    from: "Du",
    to: "Au",
    csnMembersOnly: "Membres CSN uniquement",
    bcfMembersOnly: "Membres BCF uniquement",
  },

  map: {
    resetView: "Toute la carte",
    resetViewAria: "Afficher toute la carte",
    clusterItems: (count: number) => `${count} éléments`,
    openGymLocation: "Lieu d'open gym",
    openGym: "Open gym",
    toWebsite: "Vers le site web",
    moreInfo: "Plus d'infos",
    viewClubPage: "Voir la page du club",
    fromDate: (date: string) => `À partir du ${date}`,
    clubVia: (name: string, network: string) => `${name} sur ${network}`,
    coachVia: (name: string, network: string) => `${name} via ${network}`,
  },

  clubs: {
    metaTitle: "Annuaire des clubs",
    metaDescription:
      "Tous les clubs de cheerleading : cherche par nom ou par ville et filtre par niveau, division et catégorie d'âge.",
    heading: "Annuaire des clubs",
    intro:
      "Trouve des clubs de cheerleading. Cherche par nom ou par ville et filtre par niveau, division et catégorie d'âge.",
    searchPlaceholder: "Cherche par nom de club ou ville…",
    searchAria: "Rechercher des clubs",
    filter: "Filtrer",
    level: "Niveau",
    type: "Type",
    division: "Division",
    age: "Âge",
    province: "Province",
    clear: "Effacer",
    filterAll: (label: string) => `${label} : tous`,
    one: "club",
    many: "clubs",
    ofTotal: (total: number) => ` sur ${total}`,
    emptyNoneTitle: "Pas encore de clubs",
    emptyNoneHint: "Dès que des clubs seront ajoutés, ils apparaîtront ici.",
    emptyFilteredTitle: "Aucun club trouvé",
    emptyFilteredHint: "Ajuste ta recherche ou tes filtres.",
    noTeams: "Pas encore d'équipes connues",
    csnMember: "Membre CSN",
    /** tooltip/aria for the CSN member badge */
    csnMemberAria: "Membre de Cheersport Nederland",
    csnMembersOnly: "Membres CSN uniquement",
    bcfMember: "Membre BCF",
    /** tooltip/aria for the BCF member badge */
    bcfMemberAria: "Membre de la Belgian Cheerleading Federation",
    bcfMembersOnly: "Membres BCF uniquement",
  },

  club: {
    notFoundTitle: "Club introuvable",
    metaFallback: (name: string, city: string | null) =>
      `Club de cheerleading ${name}${city ? ` à ${city}` : ""} : équipes, événements et open gyms.`,
    backToClubs: "← Retour à l'annuaire des clubs",
    founded: (year: number) => `Fondé en ${year}`,
    sectionTeams: "Équipes",
    sectionTrainingTimes: "Horaires d'entraînement",
    sectionCoaches: "Coaches",
    sectionAchievements: "Palmarès",
    sectionUpcoming: "Événements à venir",
    sectionOpenGyms: "Open gyms",
    practical: "Infos pratiques",
    trainingLocation: "Lieu d'entraînement",
    address: "Adresse",
    contact: "Contact",
    noPractical: "Infos pratiques pas encore connues",
    viewOnMap: "Voir sur la carte",
    emptyEventsTitle: "Pas encore d'événements",
    emptyEventsHint:
      "Les compétitions et workshops à venir apparaîtront ici dès qu'ils seront annoncés.",
    emptyOpenGymsTitle: "Pas encore d'open gyms",
    emptyOpenGymsHint:
      "Les créneaux d'open gym récurrents apparaîtront ici dès qu'ils seront connus.",
    emptyTrainingTitle: "Pas encore d'horaires d'entraînement",
    emptyTrainingHint:
      "Les entraînements hebdomadaires par équipe apparaîtront ici dès qu'ils seront connus.",
    otherTeam: "Autre",
    every: (weekday: string) => `Chaque ${weekday.toLowerCase()}`,
    icuCertified: "Certifié ICU",
    openGymFree: "Gratuit",
  },

  coaches: {
    metaTitle: "Coaches",
    metaDescription:
      "Les coaches des clubs de cheerleading et les coaches invités de passage : vois qui coache où et prends contact directement.",
    heading: "Coaches invités",
    introBefore:
      "Les coaches des clubs, plus les coaches invités et en tournée. Toi-même de passage ?",
    introLink: "Annonce ton séjour",
    emptyTitle: "Pas encore de coaches invités",
    emptyHint:
      "Dès qu'un coach invité annonce son séjour et qu'il est approuvé, il apparaîtra ici.",
    fromDate: (date: string) => `À partir du ${date}`,
    pageHeading: "Coaches",
    clubCoachesHeading: "Coaches de club",
    visitingHeading: "Coaches invités",
    clubHasIcuCoach: "A un coach ICU",
  },

  submit: {
    metaTitle: "Signaler · Cheer Overview",
    metaDescription:
      "Il manque un événement, un open gym ou un club ? Envoie-le-nous. Nous vérifions chaque contribution avant sa mise en ligne.",
    heading: "Envoyer une info",
    intro:
      "Il manque une compétition, un open gym ou un club sur la carte ? Ou quelque chose ne colle pas ? Envoie-le ci-dessous. Nous relisons chaque contribution à la main avant sa mise en ligne — c'est ce qui garde l'agenda fiable.",
    signInIntro:
      "Pour éviter le spam, nous te demandons de te connecter avant d'envoyer quelque chose. Tes données servent uniquement à vérifier ta contribution.",
    signInButton:
      "Se connecter avec Google pour signaler ou compléter une info",
    signInError: "La connexion avec Google a échoué. Réessaie.",
    successTitle: "Merci ! Nous examinons ta contribution.",
    successBody:
      "Dès qu'un rédacteur aura examiné ta contribution, elle apparaîtra sur le site.",
    successAgain: "Envoyer autre chose",
    signedInAs: "Connecté en tant que",
    signOut: "Se déconnecter",
    kindLegend: "De quoi s'agit-il ?",
    messageLabel: "Que veux-tu nous dire ?",
    emailLabel: "Ton adresse e-mail (facultatif)",
    emailHint: "Uniquement si nous avons une question sur ta contribution.",
    submitting: "Envoi…",
    submit: "Envoyer",
    reviewNote: "Nous vérifions chaque contribution avant publication.",
    honeypotLabel: "Laisse ce champ vide",
    notSignedInError:
      "Connecte-toi avec Google pour signaler ou compléter une info.",
    genericError: "Un problème est survenu. Réessaie.",
    networkError: "Impossible d'envoyer ta contribution. Vérifie ta connexion.",
    kindLabel: {
      event: "Événement",
      gym: "Open gym",
      club: "Club",
      coach: "Coach invité (de passage)",
      correction: "Info manquante ou incorrecte",
      feedback: "Feedback",
    },
    kindHelp: {
      event:
        "Une compétition, un workshop, un tryout, un showcase ou une autre activité.",
      gym: "Un créneau d'open gym récurrent dans un club.",
      club: "Un club, une équipe étudiante, scolaire ou de sélection qui n'est pas encore sur la carte.",
      coach:
        "Tu es un coach (invité) de passage chez nous ? Dis-nous où et quand tu es là et comment te joindre.",
      correction: "Quelque chose ne colle pas ou il manque quelque chose.",
      feedback: "Une idée, une remarque ou un problème avec le site lui-même.",
    },
    kindPlaceholder: {
      event:
        "p. ex. Open NK Cheerleading le 31 mai 2026 aux Sporthallen Zuid à Amsterdam, organisé par … — ajoute un lien ou une billetterie si tu en as.",
      gym: "p. ex. Cheer Amsterdam a un open gym tous les mercredis de 19h00 à 21h00 à la salle …",
      club: "p. ex. Nom, ville, et un site web ou Instagram. Tout ce que tu sais nous aide.",
      coach:
        "p. ex. Coach Jamie (tumbling) est à Utrecht du 12 au 20 juin, à contacter via @pseudo ou toi@exemple.be.",
      correction:
        "p. ex. L'adresse du club X est fausse, ou l'équipe Y ne s'entraîne plus le mardi.",
      feedback:
        "Dis-nous ce qui pourrait être mieux, ou ce que tu as remarqué sur le site.",
    },
    kindUrl: {
      event: {
        label: "Lien (facultatif)",
        hint: "Un site web, une billetterie ou un Instagram utile.",
      },
      gym: {
        label: "Lien (facultatif)",
        hint: "Un site web ou l'Instagram du club.",
      },
      club: {
        label: "Lien (facultatif)",
        hint: "Site web ou Instagram du club.",
      },
      coach: {
        label: "Lien (facultatif)",
        hint: "Ton site web, ton Instagram ou ta page de réservation.",
      },
      correction: {
        label: "Lien pertinent (facultatif)",
        hint: "Colle la page ou le lien lié à ce qui manque ou ne colle pas. Plusieurs ? Mets les autres dans ton message.",
      },
      feedback: {
        label: "Lien (facultatif)",
        hint: "Une page ou un lien de capture d'écran utile.",
      },
    },
  },

  validation: {
    urlTooLong: "L'URL est trop longue",
    urlInvalid: "Entre une URL valide (avec https://)",
    emailInvalid: "Entre une adresse e-mail valide",
    messageTooShort: "Dis-nous en un peu plus (au moins 5 caractères)",
    messageTooLong: "C'est vraiment très long — raccourcis un peu",
  },

  admin: {
    loadingTitle: "Review queue",
    signInHeading: "Administration",
    signInIntro: "Connecte-toi avec Google pour examiner les contributions.",
    signInError: "La connexion avec Google a échoué. Réessaie.",
    signInButton: "Se connecter avec Google",
    signOut: "Se déconnecter",
    columnUndecided: "En attente",
    columnAgreed: "Accepté",
    columnDisagreed: "Refusé",
    refresh: "Actualiser",
    retry: "Réessayer",
    counts: (total: number, decided: number) =>
      `${total} éléments · ${decided} traités`,
    nothingToReview: "Rien à examiner.",
    loadError: "Impossible de charger les éléments.",
    networkError: "Erreur réseau. Réessaie.",
    forbiddenTitle: "Pas d'accès avec ce compte",
    forbiddenBody:
      "Ce compte Google n'est pas administrateur. Déconnecte-toi et essaie un autre compte.",
    badgeSubmission: "Contribution",
    badgeEvent: "Event",
    eventFallbackTitle: "Event",
    noFields: "(aucun champ)",
    showMore: "Afficher plus",
    showLess: "Afficher moins",
    notePlaceholder: "Note (facultatif)…",
    noteDirty: "Non enregistré — clique en dehors du champ",
    noteSaving: "Enregistrement…",
    noteSaved: "Enregistré ✓",
    noteError: "Échec de l'enregistrement",
    submissionMeta: (when: string) => `Contribution · ${when}`,
    scrapedMeta: (type: string, when: string) => `Scrapé · ${type} · ${when}`,
    payload: {
      title: "titre",
      type: "type",
      start: "début",
      location: "lieu",
      url: "url",
      description: "description",
    },
  },

  about: {
    metaTitle: "À propos de Cheer Overview",
    metaDescription:
      "Cheer Overview rassemble tout le cheerleading en un seul endroit : clubs, compétitions, open gyms et horaires d'entraînement sur une carte, un agenda et un annuaire des clubs.",
    eyebrow: "À propos de ce projet",
    heading: "Tout le cheerleading, en un seul endroit",
    introBefore:
      "Cheer Overview rassemble le monde du cheerleading en un seul endroit : clubs, compétitions, open gyms et horaires d'entraînement, sur une carte, un agenda et un annuaire des clubs. Je l'ai créé parce que ces infos sont aujourd'hui éparpillées entre les sites des clubs, les réseaux sociaux et les calendriers des fédérations.",
    whatHeading: "Ce que je construis",
    whatBody:
      "Les infos sur le cheerleading sont aujourd'hui éparpillées entre les sites des clubs, les réseaux sociaux et les calendriers des fédérations. Je les rassemble. Les données sont en grande partie collectées automatiquement et complétées par les signalements de la communauté. Je vérifie à la main chaque ajout incertain ou signalé avant sa mise en ligne.",
    chipMap: "Carte",
    chipAgenda: "Agenda",
    chipClubs: "Annuaire des clubs",
    builtBy: "Créé par",
    roadmapHeading: "Roadmap",
    roadmapIntro:
      "Là où Cheer Overview se dirige : vers la région au sens large, pour qu'à terme toute la scène figure sur une seule carte.",
    roadmap: {
      belgiumTitle: "Belgique",
      belgiumBody:
        "Les clubs, compétitions et open gyms de Belgique sont désormais sur la carte — le Benelux réuni en un seul aperçu.",
      belgiumWhen: "En ligne",
      rulesAiTitle: "Assistant règlement",
      rulesAiWhen: "Plus tard",
      coachesTitle: "Page coaches enrichie",
      coachesBody:
        "Développer la page coaches existante pour les coaches déjà actifs dans les clubs : des profils plus riches avec leurs spécialités et le club où ils coachent, pour trouver plus facilement le bon coach.",
      coachesWhen: "Plus tard",
    },
    csnHeading: "À propos de Cheersport Netherlands",
    csnBody1:
      "Cheersport Netherlands (CSN) est la fédération nationale de cheerleading des Pays-Bas, basée à Maastricht. Avec les coaches, les athlètes, les écoles et les clubs, la CSN fait grandir le cheerleading autour de la collaboration, de la formation et de l'inclusivité.",
    csnVisit: "Visiter cheersport.nl",
    tcnlHeading: "À propos de Team Cheerleading Nederland",
    tcnlBody1:
      "La fondation Stichting Team Cheerleading Nederland (TCNL) porte les équipes nationales (la Dutch Equipe) qui représentent les Pays-Bas lors de compétitions internationales comme les ICU World Championships. Désignée par la CSN et portée entièrement par des bénévoles, la TCNL s'occupe des entraînements, des coaches, des tenues, des déplacements et du sponsoring. Team Cheer NL concourt en Coed, All Girl, Junior, Youth et Adaptive Abilities.",
    tcnlVisit: "Visiter teamcheerleading.nl",
    tbHeading: "À propos de Team Belgium",
    tbBody1:
      "Team Belgium est le programme d'équipes nationales de la Belgian Cheerleading Federation (BCF), la fédération belge de cheerleading et membre de l'ICU, basée à Louvain. Dès sa toute première participation aux ICU World Championships (Orlando, avril 2025), Team Belgium a décroché l'or en All Girl Elite et l'argent en Coed Elite.",
    tbVisit: "Visiter belgiancheer.be",
    ctaHeading: "Il manque quelque chose ?",
    ctaBody:
      "L'agenda grandit avec la communauté. Il manque un club, une compétition ou un open gym ? Fais-le-nous savoir.",
    ctaButton: "Signaler un élément manquant",
  },

  // ---- Analytics consent ----
  consent: {
    title: "Avis cookies",
    body: "Nous utilisons des statistiques pour voir comment le site est utilisé. Uniquement avec ton accord, et jamais pour de la publicité.",
    privacyLink: "Lis notre déclaration de confidentialité",
    accept: "Accepter",
    decline: "Refuser",
  },

  privacy: {
    metaTitle: "Confidentialité",
    metaDescription:
      "Déclaration de confidentialité de Cheer Overview : quelles données nous affichons et comment nous les traitons.",
    heading: "Confidentialité",
    lastUpdated: "Dernière mise à jour : juin 2026",
    whatHeading: "De quoi il s'agit",
    whatBody:
      "Cheer Overview est un aperçu ouvert du cheerleading : clubs, compétitions, open gyms et horaires d'entraînement. Nous collectons et affichons des informations publiquement disponibles sur les clubs et les événements.",
    dataHeading: "Quelles données",
    dataBody:
      "Les données des clubs affichées (nom, lieu, équipes, coordonnées, réseaux sociaux) proviennent de sources publiques ou ont été fournies par les clubs eux-mêmes. Nous ne stockons pas de données personnelles de compte des visiteurs et n'utilisons jamais de données à des fins publicitaires.",
    analyticsHeading: "Statistiques",
    analyticsBody:
      "Si tu y consens, nous utilisons Google Analytics pour voir comment le site est utilisé : quelles pages sont visitées et combien il y a de visiteurs. Ton adresse IP est alors tronquée. Sans ton accord, rien n'est chargé et rien n'est mesuré. Tu veux changer d'avis ? Efface les données de ce site dans ton navigateur ; nous te le redemanderons.",
    contributeHeading: "Contribuer",
    contributeBody:
      "Quand tu nous transmets des informations via le formulaire de contribution, nous les utilisons uniquement pour compléter et vérifier l'aperçu.",
    correctionsHeading: "Corrections",
    correctionsBody:
      "Quelque chose ne colle pas, ou tu veux que des données soient modifiées ou supprimées ? Fais-le-nous savoir via le formulaire de contribution et nous les adapterons.",
  },

  notFound: {
    title: "Page introuvable",
    body: "Cette page n'existe pas (ou plus). Le lien est peut-être obsolète ou contient une faute de frappe.",
    backHome: "Retour à la carte",
  },

  meta: {
    defaultTitle: "Cheer Overview : tout le cheerleading en un seul endroit",
    description:
      "Un seul aperçu de tous les clubs de cheerleading, compétitions, open gyms et horaires d'entraînement. Carte, calendrier et annuaire des clubs.",
  },
} satisfies Dictionary;

/** Locale → dictionary lookup. */
export const DICTIONARIES: Record<Locale, Dictionary> = { nl, en, fr };
