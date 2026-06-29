/**
 * UI string dictionaries (NL + EN), organized by area.
 *
 * SCOPE: UI chrome and static editorial copy ONLY. Firestore DATA — club names,
 * event titles, venue names, user submissions, blurbs, coach bios — is NEVER
 * translated; it is proper-noun / live data and flows through verbatim.
 *
 * TYPING: `nl` is the canonical shape via `satisfies Dictionary`-by-inference —
 * we derive the `Dictionary` type FROM the `nl` object, then require `en` to
 * match it exactly. A missing or misspelled key in `en` is therefore a compile
 * error (see the `satisfies Dictionary` on `en`).
 *
 * Some entries are functions (e.g. result counts, "+N" pluralization) so callers
 * pass runtime values; both languages implement the same signature.
 */
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
    tagline: "Cheer News, een open overzicht van cheerleading.",
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
    nlFull: "Nederlands",
    enFull: "Engels",
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
    metaTitle: "Inzenden · Cheer News",
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
    metaTitle: "Over Cheer News",
    metaDescription:
      "Cheer News brengt alle cheerleading samen op één plek: clubs, wedstrijden, open gyms en trainingstijden op een kaart, agenda en clubgids.",
    eyebrow: "Over dit project",
    heading: "Alle cheerleading, op één plek",
    introBefore:
      "Cheer News brengt de cheerleadingwereld samen op één plek: clubs, wedstrijden, open gyms en trainingstijden, op een kaart, agenda en clubgids. Ik heb het gemaakt omdat die informatie nu verspreid staat over clubsites, socials en federatie-agenda's.",
    whatHeading: "Wat ik bouw",
    whatBody:
      "Informatie over cheerleading staat nu verspreid over losse clubsites, social media en federatie-agenda's. Ik breng het samen. Data wordt grotendeels automatisch verzameld en aangevuld met meldingen uit de community. Elke onzekere of gemelde toevoeging controleer ik handmatig voordat die online komt.",
    chipMap: "Kaart",
    chipAgenda: "Agenda",
    chipClubs: "Clubgids",
    builtBy: "Gemaakt door",
    roadmapHeading: "Roadmap",
    roadmapIntro:
      "Waar Cheer News naartoe groeit: naar de bredere regio, zodat uiteindelijk de hele scene op één kaart komt.",
    roadmap: {
      belgiumTitle: "België",
      belgiumBody:
        "Clubs, wedstrijden en open gyms uit België erbij, zodat de Lage Landen samen op één kaart staan.",
      belgiumWhen: "Binnenkort",
      germanyTitle: "Duitse grensstreek",
      germanyBody:
        "Het aangrenzende Ruhrgebied en de Duitse grensregio, waar veel clubs vlak bij Nederland zitten.",
      germanyWhen: "Later",
      sourcesTitle: "Bronnenpagina",
      sourcesBody:
        "Eén plek voor de officiële regels: rulebooks, scoresheets en richtlijnen van de federatie, gebundeld en altijd vindbaar.",
      sourcesWhen: "Later",
      rulesAiTitle: "Regels-assistent",
      rulesAiBody:
        "Een Google NotebookLM gevuld met de officiële cheerleadingreglementen, zodat je een vraag als “mag deze stunt in level 3?” kunt stellen en meteen antwoord krijgt, met verwijzing naar de bron.",
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
    ctaHeading: "Mis je iets?",
    ctaBody:
      "De agenda groeit met de community. Ontbreekt er een club, wedstrijd of open gym? Laat het ons weten.",
    ctaButton: "Ontbrekend item melden",
  },

  // ---- Privacy page ----
  privacy: {
    metaTitle: "Privacy",
    metaDescription:
      "Privacyverklaring van Cheer News: welke gegevens we tonen en hoe we ermee omgaan.",
    heading: "Privacy",
    lastUpdated: "Laatst bijgewerkt: juni 2026",
    whatHeading: "Wat dit is",
    whatBody:
      "Cheer News is een open overzicht van cheerleading: clubs, wedstrijden, open gyms en trainingstijden. We verzamelen en tonen publiek beschikbare informatie over clubs en evenementen.",
    dataHeading: "Welke gegevens",
    dataBody:
      "De getoonde clubgegevens (naam, locatie, teams, contactgegevens, social media) komen uit openbare bronnen of zijn door clubs zelf aangeleverd. We slaan geen persoonlijke accountgegevens van bezoekers op en gebruiken geen tracking-cookies voor advertenties.",
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
    defaultTitle: "Cheer News: alle cheerleading op één plek",
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
    tagline: "Cheer News, an open overview of cheerleading.",
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
    nlFull: "Dutch",
    enFull: "English",
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
    metaTitle: "Submit · Cheer News",
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
    metaTitle: "About Cheer News",
    metaDescription:
      "Cheer News brings all cheerleading together in one place: clubs, competitions, open gyms and training times on a map, agenda and club directory.",
    eyebrow: "About this project",
    heading: "All cheerleading, in one place",
    introBefore:
      "Cheer News brings the cheerleading world together in one place: clubs, competitions, open gyms and training times, on a map, agenda and club directory. I built it because that information is currently scattered across club sites, socials and federation calendars.",
    whatHeading: "What I'm building",
    whatBody:
      "Information about cheerleading is currently scattered across separate club sites, social media and federation calendars. I bring it together. Data is mostly collected automatically and supplemented with reports from the community. Every uncertain or reported addition I check by hand before it goes live.",
    chipMap: "Map",
    chipAgenda: "Agenda",
    chipClubs: "Club directory",
    builtBy: "Built by",
    roadmapHeading: "Roadmap",
    roadmapIntro:
      "Where Cheer News is heading: to the wider region, so that eventually the whole scene is on one map.",
    roadmap: {
      belgiumTitle: "Belgium",
      belgiumBody:
        "Adding clubs, competitions and open gyms from Belgium, so the Low Countries share one map.",
      belgiumWhen: "Soon",
      germanyTitle: "German border region",
      germanyBody:
        "The neighbouring Ruhr area and German border region, where many clubs sit close to the Netherlands.",
      germanyWhen: "Later",
      sourcesTitle: "Sources page",
      sourcesBody:
        "One place for the official rules: rulebooks, scoresheets and federation guidelines, bundled and always findable.",
      sourcesWhen: "Later",
      rulesAiTitle: "Ask-the-rules assistant",
      rulesAiBody:
        "A Google NotebookLM loaded with the official cheerleading rulebooks, so you can ask a question like “is this stunt allowed in level 3?” and get an answer, with a reference back to the source.",
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
    ctaHeading: "Missing something?",
    ctaBody:
      "The agenda grows with the community. Missing a club, competition or open gym? Let us know.",
    ctaButton: "Report a missing item",
  },

  privacy: {
    metaTitle: "Privacy",
    metaDescription:
      "Cheer News privacy statement: what data we show and how we handle it.",
    heading: "Privacy",
    lastUpdated: "Last updated: June 2026",
    whatHeading: "What this is",
    whatBody:
      "Cheer News is an open overview of cheerleading: clubs, competitions, open gyms and training times. We collect and show publicly available information about clubs and events.",
    dataHeading: "What data",
    dataBody:
      "The club details shown (name, location, teams, contact details, social media) come from public sources or are supplied by clubs themselves. We do not store personal visitor account data and do not use tracking cookies for advertising.",
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
    defaultTitle: "Cheer News: all cheerleading in one place",
    description:
      "One overview of all cheerleading clubs, competitions, open gyms and training times. Map, calendar and club directory.",
  },
} satisfies Dictionary;

/** Locale → dictionary lookup. */
export const DICTIONARIES: Record<"nl" | "en", Dictionary> = { nl, en };
