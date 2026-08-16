# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small groups of real-life friends who already know each other, making weekly spread picks on NFL and CFB games against each other for bragging rights. Not strangers matched up by the app, and not real-money betting. WeekendLocks replaced a spreadsheet the group used before the app existed.

## Product Purpose

A social pick'em app for a friend group: pick NFL/CFB spreads each week, track a season-long record on a shared leaderboard, and get an automated weekly AI-generated trash-talk recap ("Power Rankings") based on real pick/record/streak data. Success is the group actually using it every week instead of the old spreadsheet, and it being genuinely fun to open.

## Positioning

A mix of community and a clean, functioning pick app. The differentiator isn't just utility — a spreadsheet already did the tracking — it's the social layer: an AI roast bot that automates the smack talk every week from real data, plus handling for the CFB-before-NFL scheduling gap (two CFB locks in the weeks before NFL opens). The product should feel closer to a fantasy football app (Sleeper / ESPN Fantasy energy) than a plain spreadsheet or generic tracker — fun and sports-branded, built to draw users in, not just utilitarian record-keeping.

## Operating Context

Used weekly during football season, mobile-first (checked from phones), inside small closed groups joined via an invite link/code. Members make picks during each week's open window (per-league, per-week open/close dates), then check results and the AI recap after games finish.

## Capabilities and Constraints

- Two leagues: NFL and CFB, each with independent weekly open/close windows.
- CFB opens ~2 weeks before NFL; during that gap, members submit two CFB locks instead of one CFB + one NFL pick.
- A weekly AI-generated "Power Rankings" recap (Claude Haiku via a Tuesday-morning cron job) ranks members worst-to-best by season record and roasts each one from real pick/streak/record data — this is core to the product, not a nice-to-have.
- No real-money wagering or payment feature exists. Picks are against a spread for bragging rights only; copy and design should not imply real-money gambling.
- Built with Expo Router (React Native + react-native-web), exported as a static web app and deployed to Vercel. UI is React Native primitives (View/Text/StyleSheet), not arbitrary HTML/CSS — a real constraint on how design work gets implemented.
- Backend is Supabase (Postgres + RLS) — picks, results, scores, and chat are all real, live data.

## Brand Commitments

Name is "WeekendLocks" / "Weekend Locks," styled with a 🔒 lock emoji and "Locks" language woven through copy ("locked in," "This Weekend's Locks," "swapped in," "Power Rankings"). Keep building on this identity rather than replacing it.

## Evidence on Hand

Real production groups exist with real members, real pick history, and real chat history — this is a live product, not a prototype. Redesigns and refinements must not casually break or discard existing data or flows.

## Product Principles

- Fun and social first, utility second — the app should feel more like a fantasy-sports companion than a bare spreadsheet replacement, without becoming gimmicky or harder to use for its weekly job (make a pick, check the board).
- Preserve the "Locks" brand voice and the AI roast bot as the product's actual differentiator — design work should amplify these, not sand them down into generic sports-app defaults.
- Never imply real-money wagering.
- Respect that this is live, in-use software for real groups — no throwaway-prototype energy.
