import type { BookingStatus } from '@/modules/bookings';
import type { PublicStayCard } from '@/modules/catalog';
import type { UserLocale } from './types';

export interface UserMessages {
  meta: {
    titleSuffix: string;
    description: string;
  };
  nav: {
    exploreStays: string;
    localGuides: string;
    customerPortal: string;
    trips: string;
    hostPortal: string;
    adminPortal: string;
    crmPortal: string;
    signIn: string;
    signOut: string;
    signingOut: string;
    demoBadge: string;
    openMenu: string;
    closeMenu: string;
  };
  switcher: {
    buttonAriaLabel: string;
    title: string;
    subtitle: string;
    languageLabel: string;
    currencyLabel: string;
    autoDetectedLabel: string;
    manualOverrideLabel: string;
    resetAuto: string;
    saving: string;
    viName: string;
    enName: string;
  };
  footer: {
    tagline: string;
    currencyNote: string;
    demoNote: string;
    exploreStays: string;
    signIn: string;
  };
  home: {
    eyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    selectedStays: string;
    selectedStaysSubtitle: string;
    exploreAllStays: string;
    pillar1Title: string;
    pillar1Body: string;
    pillar2Title: string;
    pillar2Body: string;
    pillar3Title: string;
    pillar3Body: string;
    neighborhoodTitle: string;
    neighborhoodSubtitle: string;
    browseNeighborhoods: string;
    staySingular: string;
    stayPlural: string;
    viewAction: string;
  };
  search: {
    mobileSearchTitle: string;
    allVietnamAreas: string;
    filterModalTitle: string;
    closeFiltersAria: string;
    areaLabel: string;
    checkInLabel: string;
    checkOutLabel: string;
    guestsLabel: string;
    essentialLabel: string;
    stayTypeLabel: string;
    lateCheckinMobile: string;
    lateCheckinDesktop: string;
    searchButton: string;
    resetButton: string;
    clearFiltersButton: string;
    applyFiltersButton: string;
    anyOption: string;
    allAmenities: string;
    allTypes: string;
    guestSingular: string;
    guestPlural: string;
    needBothDates: string;
    checkOutAfterCheckIn: string;
    amenities: {
      kitchen: string;
      washer: string;
      dedicated_desk: string;
      wifi: string;
    };
  };
  propertyTypes: Record<PublicStayCard['propertyType'], string>;
  stayCard: {
    noPhotos: string;
    kitchen: string;
    washer: string;
    workDesk: string;
    wifi: string;
    lateCheckinShort: string;
    perNight: string;
    totalPrefix: string;
    nightSingular: string;
    nightPlural: string;
    demoBadge: string;
    exactVndPrefix: string;
  };
  staysPage: {
    title: string;
    subtitle: string;
    showingCount: (total: number) => string;
    availableDatesSuffix: (checkIn: string, checkOut: string, nights: number) => string;
    pricingUnitNote: (currency: string) => string;
    noMatchTitle: string;
    noMatchBody: string;
    resetAllFilters: string;
    previous: string;
    next: string;
    pageOf: (page: number, totalPages: number) => string;
    loadError: string;
    tryAgain: string;
    backToHome: string;
  };
  stayDetail: {
    backToAll: string;
    hostedBy: string;
    guestsWord: string;
    bedroomSingular: string;
    bedroomPlural: string;
    bedSingular: string;
    bedPlural: string;
    bathWord: string;
    timezoneLabel: string;
    demoData: string;
    designedTitle: string;
    lateCheckinSupported: string;
    standardCheckinWindow: string;
    defaultCheckinNote: string;
    stayDuration: (min: number, max: number) => string;
    suitableForGuests: (maxGuests: number) => string;
    aboutHome: string;
    neighborhoodWalkability: string;
    hostDeclaredAmenities: string;
    amenitiesNote: string;
    houseRules: string;
    locationNotes: string;
    areaLabel: string;
    privacyExplanation: string;
    upcomingUnavailable: string;
    noPhotosYet: string;
    viewPhotoPrefix: string;
  };
  quoteWidget: {
    perNight: string;
    minMaxNights: (min: number, max: number) => string;
    datesUnavailableBadge: string;
    checkIn: string;
    checkOut: string;
    guests: string;
    calculating: string;
    datesUnavailableTitle: string;
    datesUnavailableHint: (dates: string) => string;
    seasonalRateTag: string;
    cleaningFee: string;
    totalForNights: (nights: number) => string;
    exactVndTotal: string;
    requestToBook: string;
    checkDatesAndBook: string;
    paymentTermLabel: string;
    noOnlineChargeNote: string;
    cancellationPolicyLabel: string;
    selectDatesError: string;
    checkOutAfterCheckIn: string;
    fetchError: string;
    totalMobileSubtitle: (nights: number) => string;
    perNightMobile: string;
    payHostDirectlyLabel: string;
  };
  bookingReview: {
    backToStay: string;
    title: string;
    subtitle: string;
    missingSelection: string;
    verifyError: string;
    chooseValidDates: string;
    unavailableNightPrefix: string;
    pickDifferentDates: string;
    datesWithTz: (tz: string) => string;
    nightsUnit: string;
    guestsLabel: string;
    priceDetailsTitle: string;
    seasonalRate: string;
    cleaningFee: string;
    totalLabel: string;
    exactVndPayableNote: string;
    cancellationPolicyPrefix: string;
    signInRequiredTitle: string;
    signInRequiredBody: string;
    signInKeepSelection: string;
  };
  bookingForm: {
    requestingAs: (name: string) => string;
    requestingExplanation: string;
    priceChangedTitle: string;
    priceChangedBody: (prev: string, next: string, nextVnd: string) => string;
    nightsAccommodation: (nights: number) => string;
    cleaningFee: string;
    confirmedSnapshotTotal: string;
    lockedVndNote: string;
    noteLabel: string;
    notePlaceholder: string;
    submitting: string;
    confirmUpdated: (amount: string) => string;
    sendRequest: string;
    fallbackSubmitError: string;
    networkError: string;
  };
  trips: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyBody: string;
    exploreStays: string;
    noPhoto: string;
    totalLabel: string;
    viewDetails: string;
    unlockedTitle: string;
    addressLabel: string;
    instructionsLabel: string;
    lockedNote: string;
    responseWindowPassed: string;
    nightsUnit: string;
  };
  tripDetail: {
    backToTrips: string;
    notFound: string;
    loadError: string;
    bookingPrefix: string;
    hostedBy: string;
    viewListing: string;
    unlockedTitle: string;
    defaultCheckinMsg: string;
    privateProtectedTitle: string;
    privateProtectedBody: string;
    snapshotTitle: string;
    lockedAtRequest: string;
    exactLockedVnd: string;
    timelineTitle: string;
    yourNote: string;
    hostResponse: string;
    reasonLabel: string;
    createdPrefix: string;
    byLabel: string;
  };
  tripActions: {
    manageRequest: string;
    manageConfirmed: string;
    withdrawHint: string;
    cancelHint: string;
    withdrawBtn: string;
    cancelBtn: string;
    reasonOptional: string;
    withdrawPlaceholder: string;
    cancelPlaceholder: string;
    processing: string;
    confirmWithdraw: string;
    confirmCancel: string;
    keepBooking: string;
    actionFailed: string;
    networkError: string;
  };
  bookingStatuses: Record<
    BookingStatus,
    { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }
  >;
  login: {
    title: (brand: string) => string;
    subtitle: string;
    emailLabel: string;
    passwordLabel: string;
    signingIn: string;
    signInButton: string;
    invalidCreds: string;
    networkError: string;
    demoHeading: string;
    demoSubheading: string;
  };
  notFound: {
    eyebrow: string;
    title: string;
    body: string;
    explore: string;
    backHome: string;
  };
  localGuides: {
    sectionTitlePreBooking: string;
    sectionSubtitlePreBooking: string;
    viewAllGuidesForArea: (area: string) => string;
    exploreNearbyTitle: string;
    exploreNearbyBody: (area: string) => string;
    exploreNearbyCta: string;
    coworkingTitle: string;
    videoBoothsAvailable: string;
    noVideoBooths: string;
    bookingRequiredBadge: string;
    walkInBadge: string;
    exploreIndexTitle: string;
    exploreIndexSubtitle: string;
    areaLabel: string;
    switchAreaLabel: string;
    curatedBadge: string;
    limitNote: (count: number) => string;
    filterThemeLabel: string;
    filterDurationLabel: string;
    filterBudgetLabel: string;
    filterCompanionLabel: string;
    allFilter: string;
    themes: {
      food: string;
      culture: string;
      leisure: string;
      coworking: string;
    };
    durations: {
      '1_2_hours': string;
      half_day: string;
    };
    budgets: {
      budget: string;
      moderate: string;
      splurge: string;
    };
    companions: {
      solo: string;
      group: string;
    };
    stopsHeading: string;
    stopPrefix: (n: number) => string;
    openGoogleMaps: string;
    bookPartnerPass: string;
    estimatedTotalLabel: string;
    recommendedItemsLabel: string;
    directionsLabel: string;
    sourceVerifiedLabel: (source: string, date: string) => string;
    minutesUnit: string;
    emptyGuidesTitle: string;
    emptyGuidesBody: string;
    relaxFiltersButton: string;
    browseStaysInArea: (area: string) => string;
    qrCardTitle: string;
    qrCardBody: string;
  };
}

const EN_MESSAGES: UserMessages = {
  meta: {
    titleSuffix: 'Quiet stays across Vietnam for remote work',
    description:
      'Stays in Vietnam curated for multi-week remote work. Transparent totals, full kitchens, washers, work desks, and direct host booking.',
  },
  nav: {
    exploreStays: 'Explore stays',
    localGuides: 'Local Guides',
    customerPortal: 'Customer',
    trips: 'Trips',
    hostPortal: 'Host',
    adminPortal: 'Admin',
    crmPortal: 'Admin CRM',
    signIn: 'Sign in',
    signOut: 'Sign out',
    signingOut: 'Signing out...',
    demoBadge: 'Demo',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },
  switcher: {
    buttonAriaLabel: 'Language and currency settings',
    title: 'Language & Currency',
    subtitle: 'User display preferences',
    languageLabel: 'Language',
    currencyLabel: 'Display currency',
    autoDetectedLabel: 'Auto-detected from IP',
    manualOverrideLabel: 'Custom selection',
    resetAuto: 'Auto-detect by IP',
    saving: 'Updating...',
    viName: 'Tiếng Việt',
    enName: 'English',
  },
  footer: {
    tagline:
      'Multi-week stays in Vietnam for remote workers. Dates follow each property’s local timezone.',
    currencyNote:
      'Base rates are settled in integer VND directly with your host; other currencies display estimated conversions.',
    demoNote:
      'Demo environment active: sample listings, sample bookings, and demo test accounts are labeled as Demo data.',
    exploreStays: 'Explore stays',
    signIn: 'Sign in',
  },
  home: {
    eyebrow: 'Vietnam multi-week remote stays',
    heroTitle: 'Live and work quietly across Vietnam.',
    heroSubtitle:
      'Curated homes for solo remote travelers staying two to four weeks. Clear pricing, full kitchens, in-unit laundry, and local neighborhood guidance.',
    selectedStays: 'Selected stays',
    selectedStaysSubtitle: 'Real spaces photographed in natural daylight across Vietnam.',
    exploreAllStays: 'Explore all stays',
    pillar1Title: 'Built for multi-week living',
    pillar1Body:
      'Every listing clearly shows host-declared kitchen, washing machine, work desk, and optional Wi-Fi availability.',
    pillar2Title: 'Clear arrival & late check-in',
    pillar2Body:
      'Review check-in hours and late-arrival access before booking; exact address unlocks after host confirmation.',
    pillar3Title: 'Transparent pricing upfront',
    pillar3Body:
      'Nightly rates and cleaning fees appear clearly before you request, settled directly with your host in VND.',
    neighborhoodTitle: 'Choose your neighborhood rhythm',
    neighborhoodSubtitle:
      'Quiet lakeside mornings or walkable beach quarters—pick the pace that fits your work weeks.',
    browseNeighborhoods: 'Browse all neighborhoods',
    staySingular: 'stay',
    stayPlural: 'stays',
    viewAction: 'View',
  },
  search: {
    mobileSearchTitle: 'Search stays in Vietnam',
    allVietnamAreas: 'All Vietnam areas',
    filterModalTitle: 'Search & filters',
    closeFiltersAria: 'Close search filters',
    areaLabel: 'Area or city',
    checkInLabel: 'Check-in',
    checkOutLabel: 'Check-out',
    guestsLabel: 'Guests',
    essentialLabel: 'Key essential',
    stayTypeLabel: 'Stay type',
    lateCheckinMobile: 'Late check-in available (host-declared)',
    lateCheckinDesktop: 'Late check-in supported',
    searchButton: 'Search',
    resetButton: 'Reset',
    clearFiltersButton: 'Clear filters',
    applyFiltersButton: 'Apply filters',
    anyOption: 'Any',
    allAmenities: 'All amenities',
    allTypes: 'All types',
    guestSingular: 'guest',
    guestPlural: 'guests',
    needBothDates: 'Please choose both check-in and check-out dates.',
    checkOutAfterCheckIn: 'Check-out date must be after check-in date.',
    amenities: {
      kitchen: 'Full kitchen',
      washer: 'Washing machine',
      dedicated_desk: 'Work desk',
      wifi: 'Wi-Fi (host-declared)',
    },
  },
  propertyTypes: {
    apartment: 'Apartment',
    studio: 'Studio',
    villa: 'Villa',
    house: 'House',
    homestay: 'Homestay',
  },
  stayCard: {
    noPhotos: 'No photos available',
    kitchen: 'Kitchen',
    washer: 'Washer',
    workDesk: 'Work desk',
    wifi: 'Wi-Fi',
    lateCheckinShort: 'Late check-in',
    perNight: '/ night',
    totalPrefix: 'Total',
    nightSingular: 'night',
    nightPlural: 'nights',
    demoBadge: 'Demo',
    exactVndPrefix: 'Host base:',
  },
  staysPage: {
    title: 'Explore stays in Vietnam',
    subtitle:
      'Filter by area, exact dates, guest count, host-declared essentials, and late check-in availability.',
    showingCount: (total) =>
      `Showing ${total} ${total === 1 ? 'stay' : 'stays'}`,
    availableDatesSuffix: (checkIn, checkOut, nights) =>
      ` available from ${checkIn} to ${checkOut} (${nights} ${nights === 1 ? 'night' : 'nights'})`,
    pricingUnitNote: (currency) =>
      currency === 'VND'
        ? 'Integer VND pricing'
        : `Estimated in ${currency} (settled in VND)`,
    noMatchTitle: 'No stays match these filters',
    noMatchBody:
      'Try clearing an amenity filter, choosing another neighborhood, or shifting your check-in and check-out dates.',
    resetAllFilters: 'Reset all filters',
    previous: 'Previous',
    next: 'Next',
    pageOf: (page, totalPages) => `Page ${page} of ${totalPages}`,
    loadError: 'Unable to load published stays right now.',
    tryAgain: 'Try again',
    backToHome: 'Back to home',
  },
  stayDetail: {
    backToAll: 'Back to all stays',
    hostedBy: 'Hosted by',
    guestsWord: 'guests',
    bedroomSingular: 'bedroom',
    bedroomPlural: 'bedrooms',
    bedSingular: 'bed',
    bedPlural: 'beds',
    bathWord: 'bath',
    timezoneLabel: 'Timezone',
    demoData: 'Demo data',
    designedTitle: 'Designed for remote weeks',
    lateCheckinSupported: 'Late check-in supported',
    standardCheckinWindow: 'Standard check-in window',
    defaultCheckinNote: 'Check-in details shared upon confirmation.',
    stayDuration: (min, max) => `Stay duration (${min} to ${max} nights)`,
    suitableForGuests: (max) => `Suitable for solo travelers or up to ${max} guests.`,
    aboutHome: 'About this home',
    neighborhoodWalkability: 'Neighborhood & walkability',
    hostDeclaredAmenities: 'Host-declared amenities',
    amenitiesNote:
      'Amenities below are declared directly by the host (including optional Wi-Fi checkbox).',
    houseRules: 'House rules',
    locationNotes: 'Location & calendar notes',
    areaLabel: 'Area',
    privacyExplanation:
      'For host privacy, the exact street address and check-in instructions are shared only after your booking request is confirmed.',
    upcomingUnavailable: 'Upcoming unavailable nights (next 90 days)',
    noPhotosYet: 'No photos uploaded yet',
    viewPhotoPrefix: 'View photo',
  },
  quoteWidget: {
    perNight: '/ night',
    minMaxNights: (min, max) =>
      `Min ${min} ${min === 1 ? 'night' : 'nights'}, max ${max} nights`,
    datesUnavailableBadge: 'Dates no longer available',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    guests: 'Guests',
    calculating: 'Calculating server quote...',
    datesUnavailableTitle: 'Dates no longer available',
    datesUnavailableHint: (dates) =>
      `Unavailable night(s): ${dates}. Same-day check-out and check-in on adjacent dates is allowed.`,
    seasonalRateTag: ' (seasonal rate)',
    cleaningFee: 'Cleaning fee',
    totalForNights: (nights) =>
      `Total (${nights} ${nights === 1 ? 'night' : 'nights'})`,
    exactVndTotal: 'Exact host charge (VND)',
    requestToBook: 'Request to book',
    checkDatesAndBook: 'Check dates & request to book',
    paymentTermLabel: 'Payment term',
    noOnlineChargeNote: 'No online card charge in this phase.',
    cancellationPolicyLabel: 'Cancellation policy',
    selectDatesError: 'Please select check-in and check-out dates first.',
    checkOutAfterCheckIn: 'Check-out date must be after check-in date.',
    fetchError: 'Unable to fetch quote right now.',
    totalMobileSubtitle: (nights) =>
      `${nights} ${nights === 1 ? 'night' : 'nights'} total`,
    perNightMobile: 'per night',
    payHostDirectlyLabel: 'Pay the host directly',
  },
  bookingReview: {
    backToStay: 'Edit dates or return to stay',
    title: 'Review your stay quote',
    subtitle:
      'Server-verified dates, breakdown, direct payment condition, and cancellation terms.',
    missingSelection: 'Missing stay, check-in, or check-out selection.',
    verifyError: 'Unable to verify quote.',
    chooseValidDates: 'Choose valid dates',
    unavailableNightPrefix: 'Unavailable night(s):',
    pickDifferentDates: 'Pick different dates',
    datesWithTz: (tz) => `Dates (${tz})`,
    nightsUnit: 'nights',
    guestsLabel: 'Guests',
    priceDetailsTitle: 'Price details',
    seasonalRate: ' (seasonal rate)',
    cleaningFee: 'Cleaning fee',
    totalLabel: 'Total',
    exactVndPayableNote: 'Exact locked VND payable to host',
    cancellationPolicyPrefix: 'Cancellation policy:',
    signInRequiredTitle: 'Sign in required before submitting a booking request',
    signInRequiredBody:
      'Your selected stay, dates, and guest count will be preserved when you return.',
    signInKeepSelection: 'Sign in and keep selection',
  },
  bookingForm: {
    requestingAs: (name) => `Requesting as ${name}`,
    requestingExplanation:
      'Submitting sends a pending request to the host for 24 hours (ending before local check-in). No nights are locked and no payment is charged online until the host confirms.',
    priceChangedTitle: 'Price updated by host (PRICE_CHANGED)',
    priceChangedBody: (prev, next, nextVnd) =>
      `The stay total changed from ${prev} to ${next} (locked host total: ${nextVnd}). Please review the updated total below and submit again to confirm.`,
    nightsAccommodation: (nights) =>
      `${nights} ${nights === 1 ? 'night' : 'nights'} accommodation`,
    cleaningFee: 'Cleaning fee',
    confirmedSnapshotTotal: 'Confirmed total snapshot',
    lockedVndNote: 'Exact VND total locked at request',
    noteLabel: 'Message for your host (optional)',
    notePlaceholder:
      'Share your expected arrival time, remote-work schedule, or any questions for the host...',
    submitting: 'Submitting booking request...',
    confirmUpdated: (amount) => `Confirm ${amount} & send request`,
    sendRequest: 'Send booking request',
    fallbackSubmitError: 'Could not submit your booking request. Please try again.',
    networkError: 'Could not reach the server. Please check your connection and try again.',
  },
  trips: {
    title: 'Your trips',
    subtitle:
      'Exact street address and check-in instructions become visible only after the host confirms your request.',
    emptyTitle: 'No booking requests yet',
    emptyBody: 'Explore published stays across Vietnam and calculate transparent quotes.',
    exploreStays: 'Explore stays',
    noPhoto: 'No photo',
    totalLabel: 'Total:',
    viewDetails: 'View details',
    unlockedTitle: 'Check-in details unlocked',
    addressLabel: 'Address:',
    instructionsLabel: 'Instructions:',
    lockedNote:
      'Exact address and check-in instructions remain hidden until host confirmation.',
    responseWindowPassed: 'Response window passed',
    nightsUnit: 'nights',
  },
  tripDetail: {
    backToTrips: 'Back to your trips',
    notFound: 'Booking not found.',
    loadError: 'Unable to load booking details.',
    bookingPrefix: 'Booking',
    hostedBy: 'Hosted by',
    viewListing: 'View stay listing',
    unlockedTitle: 'Check-in details unlocked',
    defaultCheckinMsg: 'Follow host check-in message.',
    privateProtectedTitle: 'Private address protected',
    privateProtectedBody:
      'The street address and entry instructions appear here only when this booking is confirmed.',
    snapshotTitle: 'Saved price snapshot',
    lockedAtRequest: 'Locked at booking request',
    exactLockedVnd: 'Exact locked VND amount',
    timelineTitle: 'Booking timeline & notes',
    yourNote: 'Your note:',
    hostResponse: 'Host response:',
    reasonLabel: 'Reason:',
    createdPrefix: 'Created',
    byLabel: 'by',
  },
  tripActions: {
    manageRequest: 'Manage request',
    manageConfirmed: 'Manage confirmed booking',
    withdrawHint: 'Withdrawing cancels your request immediately before the host responds.',
    cancelHint:
      'Cancelling releases your booked nights immediately according to the saved policy.',
    withdrawBtn: 'Withdraw request',
    cancelBtn: 'Cancel booking',
    reasonOptional: 'Reason (optional)',
    withdrawPlaceholder: 'e.g. Travel dates changed',
    cancelPlaceholder: 'e.g. Flight rescheduled',
    processing: 'Processing...',
    confirmWithdraw: 'Confirm withdrawal',
    confirmCancel: 'Confirm cancellation',
    keepBooking: 'Keep booking',
    actionFailed: 'Action failed.',
    networkError: 'Could not reach the server. Please try again.',
  },
  bookingStatuses: {
    pending: { label: 'Awaiting host response', tone: 'warning' },
    confirmed: { label: 'Booking confirmed', tone: 'success' },
    declined: { label: 'Declined by host', tone: 'danger' },
    withdrawn: { label: 'Withdrawn', tone: 'neutral' },
    expired: { label: 'Request expired', tone: 'neutral' },
    cancelled: { label: 'Cancelled', tone: 'danger' },
    completed: { label: 'Completed', tone: 'neutral' },
  },
  login: {
    title: (brand) => `Sign in to ${brand}`,
    subtitle: 'Sign in to access your trips, host workspace, or platform moderation tools.',
    emailLabel: 'Email address',
    passwordLabel: 'Password',
    signingIn: 'Signing in...',
    signInButton: 'Sign in',
    invalidCreds: 'Invalid email or password.',
    networkError: 'Could not reach authentication server.',
    demoHeading: 'Demo accounts (Development & review)',
    demoSubheading:
      'Sign in as any seeded role to inspect server-side RBAC, privacy boundaries, and bilingual portals.',
  },
  notFound: {
    eyebrow: '404 — Not found',
    title: 'We could not find that page or stay',
    body: 'This stay may be unpublished, paused by the host, or the link may have changed.',
    explore: 'Explore published stays',
    backHome: 'Back to home',
  },
  localGuides: {
    sectionTitlePreBooking: 'A day in this neighborhood',
    sectionSubtitlePreBooking:
      'Curated routes and verified remote-work spots nearby — independent from your booking.',
    viewAllGuidesForArea: (area) => `Explore full ${area} guide`,
    exploreNearbyTitle: 'Explore nearby',
    exploreNearbyBody: (area) =>
      `Your stay is confirmed. Discover curated local coffee, food routes, and verified coworking hubs around ${area}.`,
    exploreNearbyCta: 'Explore nearby',
    coworkingTitle: 'Nearby coworking & call booths',
    videoBoothsAvailable: 'Video-call booths available',
    noVideoBooths: 'Open shared tables only',
    bookingRequiredBadge: 'Booking required',
    walkInBadge: 'Walk-in pass available',
    exploreIndexTitle: 'Local neighborhood guides across Vietnam',
    exploreIndexSubtitle:
      'Curated half-day and 1–2 hour itineraries, local kitchens, and verified coworking spaces near StayNearby residences.',
    areaLabel: 'Neighborhood',
    switchAreaLabel: 'Switch neighborhood',
    curatedBadge: 'Verified Local Guide',
    limitNote: (count) => `Showing up to 5 verified routes (${count} matching)`,
    filterThemeLabel: 'Theme',
    filterDurationLabel: 'Duration',
    filterBudgetLabel: 'Budget',
    filterCompanionLabel: 'Suitable for',
    allFilter: 'All',
    themes: {
      food: 'Local food',
      culture: 'Culture & walks',
      leisure: 'Leisure',
      coworking: 'Coworking & focus',
    },
    durations: {
      '1_2_hours': '1–2 hours',
      half_day: 'Half day',
    },
    budgets: {
      budget: 'Budget',
      moderate: 'Moderate',
      splurge: 'Treat / Splurge',
    },
    companions: {
      solo: 'Solo',
      group: 'Small group',
    },
    stopsHeading: 'Curated stops',
    stopPrefix: (n) => `Stop ${n}`,
    openGoogleMaps: 'Open Google Maps',
    bookPartnerPass: 'Book partner seat',
    estimatedTotalLabel: 'Est. spend',
    recommendedItemsLabel: 'Worth trying:',
    directionsLabel: 'Getting there:',
    sourceVerifiedLabel: (source, date) => `Source: ${source} · Verified ${date}`,
    minutesUnit: 'min',
    emptyGuidesTitle: 'No published routes match this filter combination',
    emptyGuidesBody:
      'Try loosening the duration, budget, or theme filters to view verified local spots in this neighborhood.',
    relaxFiltersButton: 'Clear filters & show all routes',
    browseStaysInArea: (area) => `Browse stays in ${area}`,
    qrCardTitle: 'Public area guide link',
    qrCardBody:
      'This standalone public guide contains no guest or booking information.',
  },
};

const VI_MESSAGES: UserMessages = {
  meta: {
    titleSuffix: 'Lưu trú yên tĩnh khắp Việt Nam cho công việc từ xa',
    description:
      'Chỗ ở tuyển chọn tại Việt Nam dành cho người làm việc từ xa lưu trú nhiều tuần. Giá minh bạch, bếp đầy đủ, máy giặt, bàn làm việc và đặt trực tiếp với chủ nhà.',
  },
  nav: {
    exploreStays: 'Khám phá chỗ ở',
    localGuides: 'Địa phương',
    customerPortal: 'Khách hàng',
    trips: 'Chuyến đi',
    hostPortal: 'Chủ nhà',
    adminPortal: 'Quản trị',
    crmPortal: 'Quản trị CRM',
    signIn: 'Đăng nhập',
    signOut: 'Đăng xuất',
    signingOut: 'Đang đăng xuất...',
    demoBadge: 'Mẫu',
    openMenu: 'Mở menu',
    closeMenu: 'Đóng menu',
  },
  switcher: {
    buttonAriaLabel: 'Cài đặt ngôn ngữ và tiền tệ',
    title: 'Ngôn ngữ & Tiền tệ',
    subtitle: 'Tùy chọn hiển thị cho người dùng',
    languageLabel: 'Ngôn ngữ',
    currencyLabel: 'Tiền tệ hiển thị',
    autoDetectedLabel: 'Tự động theo địa chỉ IP',
    manualOverrideLabel: 'Đang chọn thủ công',
    resetAuto: 'Tự động theo IP',
    saving: 'Đang cập nhật...',
    viName: 'Tiếng Việt',
    enName: 'English',
  },
  footer: {
    tagline:
      'Chỗ ở nhiều tuần tại Việt Nam dành cho người làm việc từ xa. Ngày nhận và trả phòng tính theo múi giờ địa phương của từng chỗ ở.',
    currencyNote:
      'Giá gốc được chốt và thanh toán trực tiếp cho chủ nhà bằng VND; các đơn vị tiền tệ khác hiển thị giá quy đổi tham khảo.',
    demoNote:
      'Môi trường thử nghiệm đang bật: chỗ ở mẫu, đơn đặt mẫu và tài khoản mẫu đều được gắn nhãn Dữ liệu mẫu.',
    exploreStays: 'Khám phá chỗ ở',
    signIn: 'Đăng nhập',
  },
  home: {
    eyebrow: 'Lưu trú dài tuần làm việc từ xa tại Việt Nam',
    heroTitle: 'Sống và làm việc yên tĩnh khắp Việt Nam.',
    heroSubtitle:
      'Những căn hộ và nhà ở tuyển chọn cho khách lưu trú từ hai đến bốn tuần. Giá minh bạch, bếp nấu đầy đủ, máy giặt riêng và thông tin khu vực thực tế.',
    selectedStays: 'Chỗ ở nổi bật',
    selectedStaysSubtitle: 'Không gian thật được chụp dưới ánh sáng tự nhiên trên khắp Việt Nam.',
    exploreAllStays: 'Xem tất cả chỗ ở',
    pillar1Title: 'Thiết kế cho lưu trú nhiều tuần',
    pillar1Body:
      'Mỗi chỗ ở hiển thị rõ bếp nấu, máy giặt, bàn làm việc và tùy chọn Wi-Fi do chủ nhà khai báo.',
    pillar2Title: 'Nhận phòng rõ ràng & nhận phòng muộn',
    pillar2Body:
      'Xem trước khung giờ và hỗ trợ nhận phòng muộn trước khi đặt; địa chỉ chi tiết chỉ mở sau khi chủ nhà xác nhận.',
    pillar3Title: 'Minh bạch chi phí ngay từ đầu',
    pillar3Body:
      'Giá từng đêm và phí dọn dẹp hiển thị rõ trước khi gửi yêu cầu, thanh toán trực tiếp cho chủ nhà bằng VND.',
    neighborhoodTitle: 'Chọn nhịp sống khu vực phù hợp',
    neighborhoodSubtitle:
      'Buổi sáng yên tĩnh ven hồ hay khu phố đi bộ gần biển — chọn nhịp sống hợp với tuần làm việc của bạn.',
    browseNeighborhoods: 'Xem tất cả khu vực',
    staySingular: 'chỗ ở',
    stayPlural: 'chỗ ở',
    viewAction: 'Xem',
  },
  search: {
    mobileSearchTitle: 'Tìm chỗ ở tại Việt Nam',
    allVietnamAreas: 'Tất cả khu vực tại Việt Nam',
    filterModalTitle: 'Tìm kiếm & bộ lọc',
    closeFiltersAria: 'Đóng bộ lọc tìm kiếm',
    areaLabel: 'Khu vực hoặc thành phố',
    checkInLabel: 'Nhận phòng',
    checkOutLabel: 'Trả phòng',
    guestsLabel: 'Số khách',
    essentialLabel: 'Tiện nghi chính',
    stayTypeLabel: 'Loại chỗ ở',
    lateCheckinMobile: 'Có hỗ trợ nhận phòng muộn (chủ nhà khai báo)',
    lateCheckinDesktop: 'Hỗ trợ nhận phòng muộn',
    searchButton: 'Tìm kiếm',
    resetButton: 'Đặt lại',
    clearFiltersButton: 'Xóa bộ lọc',
    applyFiltersButton: 'Áp dụng bộ lọc',
    anyOption: 'Bất kỳ',
    allAmenities: 'Tất cả tiện nghi',
    allTypes: 'Mọi loại hình',
    guestSingular: 'khách',
    guestPlural: 'khách',
    needBothDates: 'Vui lòng chọn cả ngày nhận phòng và ngày trả phòng.',
    checkOutAfterCheckIn: 'Ngày trả phòng phải sau ngày nhận phòng.',
    amenities: {
      kitchen: 'Bếp đầy đủ',
      washer: 'Máy giặt riêng',
      dedicated_desk: 'Bàn làm việc',
      wifi: 'Wi-Fi (chủ nhà khai báo)',
    },
  },
  propertyTypes: {
    apartment: 'Căn hộ',
    studio: 'Studio',
    villa: 'Biệt thự',
    house: 'Nhà nguyên căn',
    homestay: 'Homestay',
  },
  stayCard: {
    noPhotos: 'Chưa có ảnh',
    kitchen: 'Bếp nấu',
    washer: 'Máy giặt',
    workDesk: 'Bàn làm việc',
    wifi: 'Wi-Fi',
    lateCheckinShort: 'Nhận phòng muộn',
    perNight: '/ đêm',
    totalPrefix: 'Tổng',
    nightSingular: 'đêm',
    nightPlural: 'đêm',
    demoBadge: 'Mẫu',
    exactVndPrefix: 'Giá gốc:',
  },
  staysPage: {
    title: 'Khám phá chỗ ở tại Việt Nam',
    subtitle:
      'Lọc theo khu vực, khoảng ngày thực tế, số khách, tiện nghi chủ nhà khai báo và hỗ trợ nhận phòng muộn.',
    showingCount: (total) => `Hiển thị ${total} chỗ ở`,
    availableDatesSuffix: (checkIn, checkOut, nights) =>
      ` còn trống từ ${checkIn} đến ${checkOut} (${nights} đêm)`,
    pricingUnitNote: (currency) =>
      currency === 'VND'
        ? 'Đơn giá tính bằng VND'
        : `Hiển thị quy đổi theo ${currency} (thanh toán chốt bằng VND)`,
    noMatchTitle: 'Không có chỗ ở phù hợp với bộ lọc này',
    noMatchBody:
      'Hãy thử bỏ bớt điều kiện tiện nghi, chọn khu vực khác hoặc điều chỉnh ngày nhận và trả phòng.',
    resetAllFilters: 'Đặt lại toàn bộ bộ lọc',
    previous: 'Trước',
    next: 'Sau',
    pageOf: (page, totalPages) => `Trang ${page} / ${totalPages}`,
    loadError: 'Hiện không thể tải danh sách chỗ ở đã công bố.',
    tryAgain: 'Thử lại',
    backToHome: 'Về trang chủ',
  },
  stayDetail: {
    backToAll: 'Quay lại danh sách chỗ ở',
    hostedBy: 'Chủ nhà:',
    guestsWord: 'khách',
    bedroomSingular: 'phòng ngủ',
    bedroomPlural: 'phòng ngủ',
    bedSingular: 'giường',
    bedPlural: 'giường',
    bathWord: 'phòng tắm',
    timezoneLabel: 'Múi giờ',
    demoData: 'Dữ liệu mẫu',
    designedTitle: 'Phù hợp cho nhiều tuần làm việc',
    lateCheckinSupported: 'Hỗ trợ nhận phòng muộn',
    standardCheckinWindow: 'Khung giờ nhận phòng tiêu chuẩn',
    defaultCheckinNote: 'Chi tiết nhận phòng được gửi sau khi chủ nhà xác nhận.',
    stayDuration: (min, max) => `Thời gian lưu trú (${min} đến ${max} đêm)`,
    suitableForGuests: (max) => `Phù hợp cho khách đi một mình hoặc tối đa ${max} khách.`,
    aboutHome: 'Giới thiệu chỗ ở',
    neighborhoodWalkability: 'Khu vực & khả năng đi bộ',
    hostDeclaredAmenities: 'Tiện nghi chủ nhà khai báo',
    amenitiesNote:
      'Các tiện nghi dưới đây do chủ nhà trực tiếp khai báo (bao gồm tùy chọn Wi-Fi).',
    houseRules: 'Nội quy chỗ ở',
    locationNotes: 'Vị trí & ghi chú lịch trống',
    areaLabel: 'Khu vực',
    privacyExplanation:
      'Để bảo vệ riêng tư cho chủ nhà, địa chỉ đường cụ thể và hướng dẫn nhận phòng chỉ hiển thị sau khi yêu cầu đặt phòng được xác nhận.',
    upcomingUnavailable: 'Các đêm đã kín lịch sắp tới (90 ngày tới)',
    noPhotosYet: 'Chưa có ảnh được tải lên',
    viewPhotoPrefix: 'Xem ảnh',
  },
  quoteWidget: {
    perNight: '/ đêm',
    minMaxNights: (min, max) => `Tối thiểu ${min} đêm, tối đa ${max} đêm`,
    datesUnavailableBadge: 'Ngày chọn không còn trống',
    checkIn: 'Nhận phòng',
    checkOut: 'Trả phòng',
    guests: 'Số khách',
    calculating: 'Đang kiểm tra báo giá từ máy chủ...',
    datesUnavailableTitle: 'Ngày bạn chọn đã hết trống',
    datesUnavailableHint: (dates) =>
      `Đêm không trống: ${dates}. Khách vẫn có thể đặt trả phòng và nhận phòng cùng ngày ở hai đơn liền kề.`,
    seasonalRateTag: ' (giá điều chỉnh theo ngày)',
    cleaningFee: 'Phí dọn dẹp',
    totalForNights: (nights) => `Tổng cộng (${nights} đêm)`,
    exactVndTotal: 'Số tiền chốt với chủ nhà (VND)',
    requestToBook: 'Gửi yêu cầu đặt phòng',
    checkDatesAndBook: 'Kiểm tra ngày & đặt phòng',
    paymentTermLabel: 'Hình thức thanh toán',
    noOnlineChargeNote: 'Không thu tiền thẻ trực tuyến ở giai đoạn này.',
    cancellationPolicyLabel: 'Chính sách hủy',
    selectDatesError: 'Vui lòng chọn ngày nhận phòng và ngày trả phòng trước.',
    checkOutAfterCheckIn: 'Ngày trả phòng phải sau ngày nhận phòng.',
    fetchError: 'Hiện không thể lấy báo giá.',
    totalMobileSubtitle: (nights) => `Tổng ${nights} đêm`,
    perNightMobile: 'mỗi đêm',
    payHostDirectlyLabel: 'Thanh toán trực tiếp cho chủ nhà',
  },
  bookingReview: {
    backToStay: 'Đổi ngày hoặc quay lại chỗ ở',
    title: 'Xem lại báo giá lưu trú',
    subtitle:
      'Ngày ở, bảng giá chi tiết, điều kiện thanh toán trực tiếp và chính sách hủy đã được máy chủ xác thực.',
    missingSelection: 'Thiếu thông tin chỗ ở, ngày nhận phòng hoặc ngày trả phòng.',
    verifyError: 'Không thể xác thực báo giá.',
    chooseValidDates: 'Chọn lại ngày hợp lệ',
    unavailableNightPrefix: 'Đêm không còn trống:',
    pickDifferentDates: 'Chọn khoảng ngày khác',
    datesWithTz: (tz) => `Khoảng ngày (${tz})`,
    nightsUnit: 'đêm',
    guestsLabel: 'Số khách',
    priceDetailsTitle: 'Chi tiết giá phòng',
    seasonalRate: ' (giá điều chỉnh theo ngày)',
    cleaningFee: 'Phí dọn dẹp',
    totalLabel: 'Tổng cộng',
    exactVndPayableNote: 'Tổng tiền VND chốt thanh toán cho chủ nhà',
    cancellationPolicyPrefix: 'Chính sách hủy:',
    signInRequiredTitle: 'Cần đăng nhập trước khi gửi yêu cầu đặt phòng',
    signInRequiredBody:
      'Chỗ ở, ngày ở và số khách bạn đã chọn sẽ được giữ nguyên khi bạn quay lại.',
    signInKeepSelection: 'Đăng nhập & giữ lựa chọn',
  },
  bookingForm: {
    requestingAs: (name) => `Đang gửi yêu cầu với tài khoản ${name}`,
    requestingExplanation:
      'Yêu cầu sẽ ở trạng thái chờ chủ nhà phản hồi trong 24 giờ (kết thúc trước giờ nhận phòng). Lịch chưa bị khóa và chưa phát sinh thanh toán trực tuyến cho đến khi chủ nhà xác nhận.',
    priceChangedTitle: 'Chủ nhà vừa cập nhật giá (PRICE_CHANGED)',
    priceChangedBody: (prev, next, nextVnd) =>
      `Tổng chi phí đã thay đổi từ ${prev} thành ${next} (tổng chốt VND: ${nextVnd}). Vui lòng kiểm tra lại bảng giá mới bên dưới và bấm gửi lại để xác nhận.`,
    nightsAccommodation: (nights) => `Tiền phòng (${nights} đêm)`,
    cleaningFee: 'Phí dọn dẹp',
    confirmedSnapshotTotal: 'Tổng giá xác nhận khi gửi đơn',
    lockedVndNote: 'Số tiền VND chốt cố định tại thời điểm gửi',
    noteLabel: 'Lời nhắn gửi chủ nhà (không bắt buộc)',
    notePlaceholder:
      'Chia sẻ giờ dự kiến đến nơi, lịch làm việc từ xa hoặc câu hỏi cho chủ nhà...',
    submitting: 'Đang gửi yêu cầu đặt phòng...',
    confirmUpdated: (amount) => `Xác nhận ${amount} & gửi yêu cầu`,
    sendRequest: 'Gửi yêu cầu đặt phòng',
    fallbackSubmitError: 'Không thể gửi yêu cầu đặt phòng. Vui lòng thử lại.',
    networkError: 'Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng và thử lại.',
  },
  trips: {
    title: 'Chuyến đi của bạn',
    subtitle:
      'Địa chỉ chi tiết và hướng dẫn nhận phòng chỉ hiển thị sau khi chủ nhà xác nhận đơn.',
    emptyTitle: 'Bạn chưa có yêu cầu đặt phòng nào',
    emptyBody: 'Khám phá các chỗ ở đang mở đặt trên khắp Việt Nam và xem báo giá minh bạch.',
    exploreStays: 'Khám phá chỗ ở',
    noPhoto: 'Không có ảnh',
    totalLabel: 'Tổng cộng:',
    viewDetails: 'Xem chi tiết',
    unlockedTitle: 'Đã mở khóa thông tin nhận phòng',
    addressLabel: 'Địa chỉ:',
    instructionsLabel: 'Hướng dẫn:',
    lockedNote:
      'Địa chỉ chính xác và hướng dẫn nhận phòng được ẩn cho đến khi chủ nhà xác nhận.',
    responseWindowPassed: 'Đã quá hạn phản hồi',
    nightsUnit: 'đêm',
  },
  tripDetail: {
    backToTrips: 'Quay lại danh sách chuyến đi',
    notFound: 'Không tìm thấy đơn đặt phòng.',
    loadError: 'Không thể tải thông tin chi tiết đơn.',
    bookingPrefix: 'Mã đơn',
    hostedBy: 'Chủ nhà:',
    viewListing: 'Xem trang chỗ ở',
    unlockedTitle: 'Đã mở khóa thông tin nhận phòng',
    defaultCheckinMsg: 'Thực hiện theo tin nhắn hướng dẫn của chủ nhà.',
    privateProtectedTitle: 'Địa chỉ riêng tư đang được bảo vệ',
    privateProtectedBody:
      'Địa chỉ đường cụ thể và hướng dẫn vào nhà chỉ hiển thị tại đây khi đơn đã được xác nhận.',
    snapshotTitle: 'Bản chụp giá đã lưu',
    lockedAtRequest: 'Đã chốt khi gửi yêu cầu',
    exactLockedVnd: 'Số tiền VND đã chốt',
    timelineTitle: 'Lịch sử & ghi chú đơn',
    yourNote: 'Lời nhắn của bạn:',
    hostResponse: 'Phản hồi của chủ nhà:',
    reasonLabel: 'Lý do:',
    createdPrefix: 'Tạo đơn',
    byLabel: 'bởi',
  },
  tripActions: {
    manageRequest: 'Quản lý yêu cầu đặt phòng',
    manageConfirmed: 'Quản lý đơn đã xác nhận',
    withdrawHint: 'Rút yêu cầu sẽ hủy đơn ngay trước khi chủ nhà phản hồi.',
    cancelHint:
      'Hủy đơn sẽ giải phóng các đêm đã khóa ngay lập tức theo chính sách đã lưu.',
    withdrawBtn: 'Rút yêu cầu',
    cancelBtn: 'Hủy đặt phòng',
    reasonOptional: 'Lý do (không bắt buộc)',
    withdrawPlaceholder: 'VD: Thay đổi kế hoạch di chuyển',
    cancelPlaceholder: 'VD: Đổi lịch chuyến bay',
    processing: 'Đang xử lý...',
    confirmWithdraw: 'Xác nhận rút yêu cầu',
    confirmCancel: 'Xác nhận hủy đơn',
    keepBooking: 'Giữ lại đơn',
    actionFailed: 'Thao tác thất bại.',
    networkError: 'Không thể kết nối máy chủ. Vui lòng thử lại.',
  },
  bookingStatuses: {
    pending: { label: 'Chờ chủ nhà xác nhận', tone: 'warning' },
    confirmed: { label: 'Đã xác nhận', tone: 'success' },
    declined: { label: 'Chủ nhà đã từ chối', tone: 'danger' },
    withdrawn: { label: 'Đã rút yêu cầu', tone: 'neutral' },
    expired: { label: 'Đã hết hạn phản hồi', tone: 'neutral' },
    cancelled: { label: 'Đã hủy', tone: 'danger' },
    completed: { label: 'Đã hoàn tất', tone: 'neutral' },
  },
  login: {
    title: (brand) => `Đăng nhập vào ${brand}`,
    subtitle:
      'Đăng nhập để xem chuyến đi của bạn, truy cập cổng Chủ nhà hoặc công cụ Quản trị.',
    emailLabel: 'Địa chỉ email',
    passwordLabel: 'Mật khẩu',
    signingIn: 'Đang đăng nhập...',
    signInButton: 'Đăng nhập',
    invalidCreds: 'Email hoặc mật khẩu không đúng.',
    networkError: 'Không thể kết nối tới máy chủ xác thực.',
    demoHeading: 'Tài khoản mẫu (Dành cho kiểm thử & trải nghiệm)',
    demoSubheading:
      'Đăng nhập nhanh với từng vai trò mẫu để kiểm tra phân quyền RBAC, bảo mật địa chỉ và đa ngôn ngữ.',
  },
  notFound: {
    eyebrow: '404 — Không tìm thấy',
    title: 'Không tìm thấy trang hoặc chỗ ở này',
    body: 'Chỗ ở có thể chưa được công bố, đang tạm ẩn hoặc đường dẫn đã thay đổi.',
    explore: 'Khám phá chỗ ở đang mở',
    backHome: 'Về trang chủ',
  },
  localGuides: {
    sectionTitlePreBooking: 'Một ngày ở khu vực này',
    sectionSubtitlePreBooking:
      'Lịch trình gợi ý và điểm làm việc đã kiểm chứng quanh chỗ ở — độc lập với quy trình đặt phòng.',
    viewAllGuidesForArea: (area) => `Xem đầy đủ cẩm nang ${area}`,
    exploreNearbyTitle: 'Khám phá quanh đây',
    exploreNearbyBody: (area) =>
      `Đơn của bạn đã được xác nhận. Khám phá quán cà phê làm việc, tuyến ẩm thực và coworking đã xác minh tại ${area}.`,
    exploreNearbyCta: 'Khám phá quanh đây',
    coworkingTitle: 'Coworking & phòng họp gần đây',
    videoBoothsAvailable: 'Có buồng gọi video',
    noVideoBooths: 'Chỉ có bàn chung',
    bookingRequiredBadge: 'Cần đặt chỗ trước',
    walkInBadge: 'Có thể đến trực tiếp',
    exploreIndexTitle: 'Cẩm nang khu vực khắp Việt Nam',
    exploreIndexSubtitle:
      'Lịch trình 1–2 giờ hoặc nửa ngày, quán ăn bản địa và điểm coworking đã kiểm chứng quanh các chỗ ở StayNearby.',
    areaLabel: 'Khu vực',
    switchAreaLabel: 'Đổi khu vực',
    curatedBadge: 'Cẩm nang đã kiểm chứng',
    limitNote: (count) => `Hiển thị tối đa 5 tuyến đã công bố (${count} kết quả phù hợp)`,
    filterThemeLabel: 'Chủ đề',
    filterDurationLabel: 'Thời lượng',
    filterBudgetLabel: 'Ngân sách',
    filterCompanionLabel: 'Phù hợp cho',
    allFilter: 'Tất cả',
    themes: {
      food: 'Ẩm thực bản địa',
      culture: 'Văn hóa & dạo bộ',
      leisure: 'Thư giãn',
      coworking: 'Coworking & tập trung',
    },
    durations: {
      '1_2_hours': '1–2 giờ',
      half_day: 'Nửa ngày',
    },
    budgets: {
      budget: 'Tiết kiệm',
      moderate: 'Vừa phải',
      splurge: 'Trải nghiệm cao',
    },
    companions: {
      solo: 'Đi một mình',
      group: 'Đi nhóm nhỏ',
    },
    stopsHeading: 'Các điểm dừng theo thứ tự',
    stopPrefix: (n) => `Điểm ${n}`,
    openGoogleMaps: 'Mở Google Maps',
    bookPartnerPass: 'Đặt chỗ đối tác',
    estimatedTotalLabel: 'Chi phí dự kiến',
    recommendedItemsLabel: 'Gợi ý nên thử:',
    directionsLabel: 'Chỉ đường:',
    sourceVerifiedLabel: (source, date) => `Nguồn: ${source} · Kiểm chứng ${date}`,
    minutesUnit: 'phút',
    emptyGuidesTitle: 'Chưa có tuyến nào khớp với bộ lọc hiện tại',
    emptyGuidesBody:
      'Hãy thử nới lỏng điều kiện thời lượng, ngân sách hoặc chủ đề để xem các tuyến đã kiểm chứng tại khu vực này.',
    relaxFiltersButton: 'Xóa bộ lọc & hiện tất cả',
    browseStaysInArea: (area) => `Xem chỗ ở tại ${area}`,
    qrCardTitle: 'Liên kết cẩm nang công khai',
    qrCardBody:
      'Trang khám phá công khai này hoàn toàn độc lập và không chứa bất kỳ dữ liệu khách hay đơn đặt phòng nào.',
  },
};

export function getUserMessages(locale: UserLocale): UserMessages {
  return locale === 'vi' ? VI_MESSAGES : EN_MESSAGES;
}

export function localizePaymentTerms(
  rawTerms: string,
  locale: UserLocale
): string {
  if (locale === 'vi' && rawTerms === 'Pay the host directly') {
    return 'Thanh toán trực tiếp cho chủ nhà';
  }
  return rawTerms;
}
