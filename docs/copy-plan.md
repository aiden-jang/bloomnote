# Bloomnote copy upgrade plan

Status: reapplied locally to the updated main branch. The copy pass is applied to the application and supporting documentation. Runtime, browser, and audit limitations are recorded below; this is not a deployment record.

**1. The direction**

Bloomnote should sound like someone making a thoughtful gesture without giving a speech about it. Short, observant, affectionate, and occasionally dry. The flowers provide the small extravagance. The interface does not need to keep announcing how meaningful everything is.

The main headline is **A note. With flowers.** The explanation is **Write someone a note. We’ll grow a garden from the details.** The primary action remains **grow their garden**.

Keep the botanical stationery, existing layout, typography, garden rendering, and reveal. Give the writing more consistency and make the product easier to understand.

**2. Voice and editorial rules**

| Rule                              | Application                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Understate the gesture            | A small botanical overreaction.                                                                                                                                  |
| Keep affection visible            | A sincere sentence can finish without a joke.                                                                                                                    |
| Use concrete details              | A tide journal, an extra hour after class, a place the two people remember.                                                                                      |
| Keep the speaker clear            | Interface copy, supplied examples, generated flower meanings, and the sender’s actual note are different sources.                                                |
| Be clear about actions            | Copy link, save image, remove from library, and restore copies must describe their actual effects.                                                               |
| Keep humor occasional             | One supporting line can carry a screen. Routine controls stay ordinary.                                                                                          |
| Preserve the existing case system | Lowercase controls, helper text, and sample messages; sentence case for the expressive headings and factual status/error paragraphs. Keep the existing wordmark. |

Avoid confrontational endings such as “deal with it” and “don’t make it weird”, dismissive filler such as “etc etc”, conspicuous meme slang, unnecessary exclamation marks, and repeated qualifiers about how small, tiny, or little everything is.

Keep strong existing lines, including **A small botanical overreaction.** and the empty-library line **Nothing growing yet. Very low maintenance.** Use the former only when the occasion supports it.

Do not rewrite user-entered names, notes, secrets, journal meanings, voice memories, saved gardens, or existing generated prose. Preserve intentional lowercase and punctuation inside personal content. Typographic cleanup applies to authored interface copy and supplied examples.

**3. Scope and product facts**

The pass covers the composer, supplied writing prompts and demonstrations, growing and regrowing feedback, sharing, recipient reveal, secret and schedule helpers, library, journal and memories, backup and restore, recovery/errors, exported captions, metadata, and supporting documentation.

Keep stored occasion/mood values, existing draft storage, links, limits, timers, permissions, generation budgets, flower geometry, and account behavior. Restrict behavior changes to selecting the correct authored copy for an occasion and reporting existing outcomes accurately.

Important facts the wording must retain:

- Anyone with a garden link can read its contents. An account is optional.
- Scheduling controls the normal reveal presentation. It does not encrypt or secure a garden.
- A secret is a tap-to-reveal aside, not a separately protected message.
- Growing a garden does not send it to the recipient. The sender shares its link.
- Removing a garden from a library leaves its shared link working.
- Device-only drafts, journal entries, and voice memories are distinct from account collections.
- Restore creates labelled copies with new links. It does not restore an original link or overwrite an original gift.

**4. Occasion-sensitive copy policy**

Use the actual selected occasion for the current composition/attempt and the stored occasion when displaying a saved garden. Do not classify the person’s note using keyword searches or an additional model call.

| Context                                                         | Authored supporting copy                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Just because, birthday, thank you, anniversary, congratulations | Warm, restrained humor is allowed.                                                                      |
| Sympathy                                                        | Plain, gentle, and brief. No jokes about the note, the flowers, the recipient, or the wait.             |
| Get well                                                        | Gentle company. No jokes about illness, medical advice, recovery deadlines, or an obligation to return. |
| Missing or unknown occasion on an old garden                    | Neutral supporting copy. Keep the garden available and the original words intact.                       |

A playful or celebratory mood never enables generic interface jokes for sympathy or get-well. A sender can still write a funny personal note; the interface leaves those words intact.

Use one small, pure occasion decision shared by the relevant components. Reuse the sensitive-occasion distinction already present in `packages/web/src/lib/rituals.ts` instead of duplicating lists. Keep this decision separate from `packages/web/src/lib/quietMode.ts`, which controls journal tallies and is a different preference.

Apply the policy to the preview caption, growing aside, note guidance, prompt alternatives, and forecast detail helper. Keep date, account, privacy, backup, and error copy factual for every occasion.

**5. Composer: exact copy**

Owners: `packages/web/src/components/ComposerFrame.tsx`, `packages/web/src/components/Composer.tsx`, `packages/web/src/components/NoteField.tsx`, and `packages/web/src/components/ComposerSecret.tsx`.

| Element                           | Final copy                                                  |
| --------------------------------- | ----------------------------------------------------------- |
| Main headline                     | A note. With flowers.                                       |
| First-visit introduction          | Write someone a note. We’ll grow a garden from the details. |
| Returning draft introduction      | Your note is still here. Pick up wherever you left it.      |
| Reply introduction                | A garden came your way. Leave something back.               |
| Note label                        | your note                                                   |
| General note helper               | One specific detail goes a long way.                        |
| Sensitive-occasion note helper    | A short note is enough.                                     |
| Use-example action                | use this thought                                            |
| Next-example action               | another thought ↻                                           |
| Sender and recipient labels       | from / to                                                   |
| Optional-options disclosure       | occasion & mood                                             |
| Main action                       | grow their garden                                           |
| Reply action                      | grow one back                                               |
| Draft removal                     | clear draft                                                 |
| Draft removal feedback            | Draft cleared.                                              |
| Draft recovery                    | undo                                                        |
| Example specimen label            | example garden                                              |
| Generated specimen label          | your garden                                                 |
| Ordinary preview caption          | No vase required.                                           |
| Sensitive/unknown preview caption | A garden for your note.                                     |
| Secret disclosure                 | add a secret                                                |
| Secret field label                | a little aside they can tap to reveal                       |
| General secret placeholder        | p.s. there was one more thing.                              |
| Sensitive secret placeholder      | One more thing you’d like them to know.                     |

Keep the existing note and secret limits and the real character counters. “Use this thought” only fills an empty note after the person chooses it. Switching suggestions, occasions, or moods must never replace typed words or a saved draft.

Shorten the disabled-button explanations without hiding the missing field:

| Missing input                          | Final copy                                                              |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Recipient and note                     | add a recipient and a note to get started                               |
| Recipient and a partially written note | add a recipient and a few more words                                    |
| Recipient only                         | add a name in the “to” field                                            |
| Note only                              | write them a note first                                                 |
| Note below the existing minimum        | a few more words and it’s ready                                         |
| Invalid scheduled time                 | check the opening time above                                            |
| Schedule enabled without a time        | choose an opening time, or cancel the schedule to open it straight away |

Cancelling the schedule changes when the garden opens; it does not send a message. Update the current instruction that says “send now” accordingly.

**6. Occasion and mood labels**

Owners: `packages/web/src/lib/occasions.ts` and `packages/web/src/lib/moods.ts`. Change visible labels only. Stored values, API canonical mappings, palette directions, and model hints retain their meanings.

| Existing occasion value | Visible label |
| ----------------------- | ------------- |
| just-because            | just because  |
| birthday                | birthday      |
| thank-you               | thank you     |
| anniversary             | anniversary   |
| congrats                | congrats      |
| get-well                | get well      |
| sympathy                | sympathy      |

| Existing mood value | Visible label |
| ------------------- | ------------- |
| none                | natural       |
| tender              | soft          |
| playful             | playful       |
| wistful             | wistful       |
| celebratory         | celebratory   |
| steady              | steady        |

Use clear choices instead of making each chip a joke. Keep brand personality in the surrounding writing.

**7. Complete supplied note sequence**

Owner: `packages/web/src/lib/placeholders.ts`. These are editable examples, never assertions about a real relationship. The person chooses whether to use one.

Preserve the existing default/selected-mood fallback, de-duplication, prompt cycling, empty-field insertion, and input limits. The tables below give every occasion its default and every named mood variant. The “natural” mood uses the default entry.

Just because:

| Variant     | Example                                                         |
| ----------- | --------------------------------------------------------------- |
| default     | no reason. just thinking about you and figured you should know. |
| tender      | thinking about you. you’re good to have around.                 |
| playful     | you crossed my mind. got flowers involved.                      |
| wistful     | drove past our old spot today. thought of you there.            |
| celebratory | no occasion. just felt like making a small fuss over you.       |
| steady      | nothing particular to say. just glad you’re around.             |

Birthday:

| Variant     | Example                                                      |
| ----------- | ------------------------------------------------------------ |
| default     | happy birthday. glad you’re here.                            |
| tender      | happy birthday. very glad i get to know you.                 |
| playful     | happy birthday. another excellent excuse to get food.        |
| wistful     | happy birthday. wish we were getting cake in the same place. |
| celebratory | happy birthday. i made a small fuss. flowers were involved.  |
| steady      | happy birthday. same team, another year.                     |

Thank you:

| Variant     | Example                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| default     | thanks for the other day. i should have said it properly, so here we are. |
| tender      | you made a difficult day easier. just wanted you to know.                 |
| playful     | thanks for coming through. i got flowers involved.                        |
| wistful     | still think about that thing you did. thank you, properly this time.      |
| celebratory | you really came through. consider these a small round of applause.        |
| steady      | thanks for being the person i can ask. it makes a difference.             |

Anniversary:

| Variant     | Example                                                    |
| ----------- | ---------------------------------------------------------- |
| default     | another year of us. still a good arrangement.              |
| tender      | i’d pick this again. and you, obviously.                   |
| playful     | another year of deciding what to eat together. still in.   |
| wistful     | thinking about where we started. glad it turned into this. |
| celebratory | happy anniversary. quite like what we’ve got going on.     |
| steady      | same us. another year. i like that.                        |

Congratulations:

| Variant     | Example                                                  |
| ----------- | -------------------------------------------------------- |
| default     | knew you had it. still nice to see it happen.            |
| tender      | you worked for this. i’m really glad you get to have it. |
| playful     | you did the thing. will be mentioning that i know you.   |
| wistful     | remember when this was just an idea. look at you.        |
| celebratory | you did it. flowers felt appropriate.                    |
| steady      | proud of you. you put the work in.                       |

Get well:

| Variant     | Example                                                          |
| ----------- | ---------------------------------------------------------------- |
| default     | thinking of you. hope today feels a little easier.               |
| tender      | wish i could make this easier. sending you a little company.     |
| playful     | sending some company for today. reply whenever you feel like it. |
| wistful     | miss having you around. thinking of you while you rest.          |
| celebratory | rooting for you. taking it one day at a time.                    |
| steady      | i’m around if you need anything. no need to reply.               |

Sympathy:

| Variant     | Example                                                     |
| ----------- | ----------------------------------------------------------- |
| default     | thinking of you. i’m here if you want company.              |
| tender      | i don’t have the right words. i’m thinking of you.          |
| playful     | i’m here. we can talk, or we can just sit.                  |
| wistful     | thinking of you, and of them. here to listen when you want. |
| celebratory | sending you care. there’s no need to find words today.      |
| steady      | you don’t have to reply. just know i’m here.                |

Read all alternatives for a sensitive occasion together: the alternate-suggestion action can reach other mood variants. Every one must remain appropriate even when a different mood was originally selected.

**8. Writing invitations and forecast helpers**

Owners: `packages/web/src/lib/rituals.ts`, `packages/web/src/lib/gardenForecast.ts`, and `packages/web/src/components/GardenForecastPanel.tsx`.

Retain the existing visit-time selection and its stable clock while someone writes. Replace the time-based invitations with:

| Time      | General invitation                      | Sensitive-occasion invitation        | Sensitive supporting line                 |
| --------- | --------------------------------------- | ------------------------------------ | ----------------------------------------- |
| Morning   | what would you like them to know today? | thinking of them is enough to start. | one honest line is plenty.                |
| Afternoon | what made you think of them?            | you can keep this simple.            | saying you’re thinking of them is enough. |
| Evening   | anything you’d like to leave with them? | there’s no set way to write this.    | use your own words.                       |
| Night     | what’s on your mind?                    | you can leave a short note.          | there’s no need for a big message.        |

Remove the current sensitive-night suggestion “if you cannot sleep, you can just say that”. The time of a visit does not establish whether the sender can sleep.

Keep forecast colors, shapes, time-of-day light, and the existing local detail calculation. Change its authored writing to feel like help rather than a grade:

| Element/state                             | Final copy                                                        |
| ----------------------------------------- | ----------------------------------------------------------------- |
| Forecast label                            | garden direction                                                  |
| Estimated appearance                      | likely {shape} in {palette}, under {light}.                       |
| Short/general note                        | A memory, place, or habit can help. Short notes work too.         |
| Some detail                               | There’s something to work with here. Add more if you want.        |
| More detail                               | These details give the garden its direction.                      |
| Any sensitive occasion, all detail levels | Your note can stay simple.                                        |
| Forecast qualification                    | A preview of the direction. The flowers may turn out differently. |

The forecast is a local estimate, not model output or a guarantee. Do not infer emotional adequacy from note length or punctuation. Keep its decorative indicators non-interactive and avoid adding score labels.

**9. Curated demonstration gardens**

Owner: `packages/web/src/data/exampleGardens.ts`, presented through `packages/web/src/components/ExampleCarousel.tsx` and `packages/web/src/lib/useHeroDemo.ts`.

Retain the synthetic people, core details, occasions, palettes, flower counts, and visual geometry. Rewrite the supplied messages as follows:

| Demonstration               | Supplied note                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Maya → Sarah, birthday      | happy birthday, sarah. hope the tides are interesting and your own jokes continue to entertain you. glad you’re here.    |
| Casey → Jamie, just because | saw a kite on the beach today. thought of that windy afternoon in half moon bay. hope LA’s being nice to you.            |
| Theo → Dr. Park, thank you  | dr. park, you stayed an extra hour after class and gradient descent finally clicked. thank you for making it make sense. |

Make the demonstration flower names consistent with the product’s promise of real flowers. Preserve their existing rendering data:

| Demonstration | Current label → final label | Final meaning                                        |
| ------------- | --------------------------- | ---------------------------------------------------- |
| Sarah         | Marigold → Marigold         | for laughing at your own jokes. someone has to.      |
| Sarah         | Coral Rose → Rose           | for a friend who’s very easy to keep around.         |
| Sarah         | Sunflower → Sunflower       | for the tide journal and all the attention it takes. |
| Sarah         | Cosmos → Cosmos             | for noticing the small things the water keeps doing. |
| Jamie         | Bluebell → Bluebell         | for that windy afternoon in half moon bay.           |
| Jamie         | Dusty Mauve → Iris          | for the kite that brought the afternoon back.        |
| Jamie         | Sage Bloom → Hellebore      | for a memory that still comes to mind.               |
| Dr. Park      | Terracotta Rose → Rose      | for the extra hour after class.                      |
| Dr. Park      | Forest Bloom → Carnation    | for sticking with the explanation.                   |
| Dr. Park      | Cream Peony → Peony         | for the moment gradient descent finally made sense.  |

Names such as “Sage Bloom” and “Forest Bloom” are invented labels, while the model instructions require real flowers. Correct the supplied text without changing generation rules or rewriting stored gardens. Update any derived demonstration labels, expectations, or screenshots that name these flowers.

Keep demonstrations clearly labelled as examples. They must not look like a generated result for someone who has not submitted a note.

**10. Growing, completion, and regrowing**

Owners: `packages/web/src/components/GrowFeedback.tsx`, `packages/web/src/components/ShareCard.tsx`, and `packages/web/src/lib/useGardenDesign.ts`.

| Element/state                   | Final copy                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| Growing heading                 | Growing their garden.                                                               |
| General growing aside           | A small botanical overreaction.                                                     |
| Sensitive/unknown growing aside | Choosing flowers for your note.                                                     |
| Waiting for design              | choosing flowers…                                                                   |
| Saving a link                   | saving the garden…                                                                  |
| Regrowing                       | choosing different flowers…                                                         |
| Cancel action                   | cancel                                                                              |
| Ready with recipient            | {name}’s garden is ready                                                            |
| Ready without recipient         | ready to send                                                                       |
| Scheduled ready state           | {name}’s garden opens later                                                         |
| Scheduled ready fallback        | your garden opens later                                                             |
| Delivery explanation            | Nothing has been sent. Share the link with {name or your person} when you’re ready. |
| Regrow action                   | different flowers                                                                   |
| New composition                 | make another                                                                        |

Status lines must follow actual request phases. Keep cancel, timeout, failed saves, draft preservation, and the existing completed-garden restore behavior during a failed reroll. Do not promise that cancelled or failed work was saved.

Keep a clear distinction between a finished design and a saved, shareable garden. If a generation finishes but saving its link fails, explain the failure and retain the draft.

**11. Recipient reveal, notes, and replies**

Owners: `packages/web/src/components/RecipientView.tsx`, `packages/web/src/components/RecipientHeader.tsx`, `packages/web/src/components/ComposerPreview.tsx`, `packages/web/src/components/BouquetNote.tsx`, `packages/web/src/components/FlowerLegend.tsx`, and `packages/web/src/components/RemixContext.tsx`.

| Element                       | Final copy                            |
| ----------------------------- | ------------------------------------- |
| Recipient headline            | A garden for {name or you}.           |
| Byline                        | From {sender}                         |
| Open action                   | open the garden                       |
| Opening helper                | {number} flowers, chosen for you.     |
| Flower interaction hint       | tap a flower to see what it means     |
| Original-note fallback        | a garden, for you.                    |
| Generated explanation label   | why these flowers                     |
| Secret action                 | a secret for you                      |
| Secret open action            | hide the secret                       |
| Saved-to-account confirmation | saved to your gardens                 |
| Reply with sender             | grow {sender} a garden                |
| Reply without sender          | grow one back                         |
| New-person action             | write one for someone else            |
| Sender preview label          | what {recipient} sees / what they see |
| Full preview action           | preview the full reveal               |
| Reply context                 | replying to {sender} / replying       |

Do not add a punchline immediately before or after the person’s actual note. Keep their words, signatures, secrets, original flower meanings, and previous-garden quotation intact.

Use the same secret action labels in the sender preview and actual recipient view. Keep expanded state, reveal timing, keyboard focus, reduced motion, and screen-reader output equivalent. Do not narrate a recipient as if they were a third person or frame a reply as something owed.

The sender’s original note and the generated “why these flowers” explanation must remain visually and semantically distinct. Do not imply that the generated explanation was handwritten by the sender.

**12. Watering, reactions, and recaps**

Owners: `packages/web/src/components/Watering.tsx`, `packages/web/src/lib/water.ts`, `packages/web/src/components/GardenLibraryHighlights.tsx`, and `packages/web/src/lib/gardenImpact.ts`.

Keep **water it**, **you watered it**, and the optional reaction choices **love**, **comfort**, **joy**, and **a hug**. Keep their saved IDs, counters, and reply behavior. The garden must not be described as thirsty, neglected, or dependent on attendance.

Use **send a feeling back** for the optional reaction prompt and **sent back {feeling}** only after that request succeeds. Retain factual failure feedback and retry.

The current watering control is optimistic and marks the gesture locally before its request returns. Do not add “the sender saw it”, “delivered”, or “sent” confirmations to that gesture unless the actual response establishes them.

| Recap element          | Final copy                                |
| ---------------------- | ----------------------------------------- |
| Recap heading          | what came back                            |
| Recap introduction     | A few things came back from your gardens. |
| Water total            | watering gestures                         |
| Feeling total          | feelings sent back                        |
| Responded-garden total | gardens with a response                   |
| Most frequent feeling  | most sent back: {feeling}                 |
| Most-watered garden    | most watered: the one for {name}          |
| Recap action           | share this recap                          |

Keep every statistic tied to the existing aggregate it measures. Counts are gestures, not unique people or read receipts. Do not use them to judge the relationship or imply the recipient definitely felt an emotion.

**13. Sharing, images, and keepsakes**

Owners: `packages/web/src/components/ShareCard.tsx`, `packages/web/src/components/GardenRow.tsx`, `packages/web/src/lib/useShareActions.ts`, `packages/web/src/lib/useRecipientKeepsakes.ts`, `packages/web/src/lib/gardenImage.tsx`, `packages/web/src/lib/imageCards.tsx`, and `packages/web/src/lib/GardenDuetImage.tsx`.

| State/action                        | Final copy                    |
| ----------------------------------- | ----------------------------- |
| Share link                          | share                         |
| Link preparation for native sharing | opening sharing…              |
| Native share operation resolved     | share sheet closed            |
| Copy link                           | copy link                     |
| Clipboard success                   | link copied                   |
| Save an image                       | save as image                 |
| Image preparation                   | making image…                 |
| Image native share resolved         | share sheet closed            |
| Download initiated                  | download started              |
| Share a received garden             | share this garden             |
| Keepsake disclosure                 | keep this garden              |
| Duet action                         | save both gardens as an image |
| Duet preparation                    | making image…                 |
| Copy original note                  | copy the note                 |
| Original-note clipboard success     | note copied                   |
| Print                               | print the garden              |
| Replay                              | watch it bloom again          |

Use the same state wording in the composer, library rows, recipient view, duet export, and recap sharing. Native share completion does not prove delivery to another person. Cancellation stays quiet and does not imply a failure or trigger a second download.

Retain the existing native share text **A garden for {recipient}**, **A garden from {sender}**, and **A garden for you**. A gift link does not need the app’s joke attached to it.

Preserve image content, names, flower meanings, dates, and the original note where that export includes it. Review generated image text for wrapping, actual save/share state, and correct sender/recipient perspective. Avoid app slogans over the person’s message. Existing shared links and write-once social images must not be overwritten by a copy update.

**14. Scheduling and secret meaning**

Owners: `packages/web/src/components/ScheduleInput.tsx`, `packages/web/src/components/ScheduleCalendar.tsx`, `packages/web/src/components/SealedView.tsx`, and schedule decisions in `packages/web/src/lib/composerHelpers.ts`.

| Element                            | Final copy                                                      |
| ---------------------------------- | --------------------------------------------------------------- |
| Schedule entry action              | choose when it opens                                            |
| Schedule heading                   | when should it open?                                            |
| Selected time                      | opens {local date and time}                                     |
| Cancel schedule                    | cancel schedule                                                 |
| Invalid time                       | Choose a valid opening time.                                    |
| Past/too-close time                | Choose a later opening time.                                    |
| Scheduled recipient heading        | A garden is waiting.                                            |
| Scheduled recipient byline         | {sender or Someone} made {recipient or you} a garden.           |
| Countdown label                    | opens in                                                        |
| Return helper                      | Come back when it opens.                                        |
| Reminder disclosure                | add a reminder                                                  |
| Calendar file initiated            | calendar file ready                                             |
| Calendar follow-up                 | Open the downloaded file to add its 15-minute reminder.         |
| Schedule elapsed during generation | The scheduled time passed while growing. This garden opens now. |

Keep exact local dates, timezone labels, existing validation grace, countdown behavior, and calendar-event details accurate. State **Nothing has been sent** in the sender’s scheduled result too. Scheduling does not deliver a future message or notification automatically.

Keep privacy explanations explicit that the reveal time and tap-to-reveal secret are presentation features. Avoid “only they can open it”, “locked away”, “private until then”, and other wording that implies access control the product does not provide.

**15. Library, journal, voice, and memories**

Owners: `packages/web/src/components/MyGardens.tsx`, `packages/web/src/components/GardenLibraryShell.tsx`, `packages/web/src/components/GardenRow.tsx`, `packages/web/src/components/LibraryTabs.tsx`, `packages/web/src/components/FlowerJournalShelf.tsx`, `packages/web/src/components/FlowerPeek.tsx`, `packages/web/src/components/MemoryTrail.tsx`, and the corresponding library/journal helpers.

| Element                          | Final copy                                                          |
| -------------------------------- | ------------------------------------------------------------------- |
| Library heading                  | your gardens                                                        |
| Account-library explanation      | the gardens you’ve grown and kept, saved to your account.           |
| Device-library explanation       | the gardens you’ve grown, saved on this device.                     |
| Empty sent library               | Nothing growing yet. Very low maintenance.                          |
| Empty sent action                | grow one                                                            |
| Empty received library           | Gardens you keep will appear here.                                  |
| Empty pinned filter              | no pinned gardens here yet.                                         |
| No search results                | no gardens match “{query}”.                                         |
| Reset filters                    | show them all                                                       |
| Search placeholder               | find a garden                                                       |
| Row actions                      | pin / unpin / share / save image / remove from library              |
| Removal explanation              | This removes it from your library. Its shared link will still work. |
| Journal heading                  | my flower journal                                                   |
| Journal storage explanation      | kept only on this device                                            |
| Journal meaning helper           | what would you like to remember about this flower?                  |
| Journal meaning actions          | save / cancel                                                       |
| Voice capture                    | record a memory                                                     |
| Active voice state               | recording…                                                          |
| Finish voice capture             | stop recording                                                      |
| Voice playback accessible labels | Play this voice memory / Pause this voice memory                    |
| Voice removal accessible label   | Delete this voice memory                                            |
| Memory revisit heading           | a garden to revisit                                                 |
| Memory revisit navigation        | another                                                             |

Use active **recording…** where audio is actually being recorded; the current “listening…” can obscure that this is a saved voice-memory feature. Keep microphone permission outcomes, recordings that failed to save, device-only persistence, and recording stop/release behavior factual. Do not promise the audio is retained if saving failed.

Keep sent and received collections distinct. An empty received library is not evidence that nobody has ever sent the person a gift. Keep search-empty, actual-empty, loading, signed-out, and failed account-library states separate.

Preserve quiet mode and its default, shelves, pins, user-entered meanings, playback controls, and memory-selection rules. Recap lines may describe recurring subjects supported by journal data. Remove language that would imply attendance obligations, private thoughts, or knowledge beyond the saved entries. An interface refresh must not erase a local journal or voice recording.

**16. Account, backup, errors, and privacy**

Owners include `packages/web/src/components/BackupRestore.tsx`, `packages/web/src/components/AuthNav.tsx`, `packages/web/src/components/LegalPage.tsx`, `packages/web/src/components/ErrorBoundary.tsx`, `packages/web/src/App.tsx`, `packages/web/src/lib/designGarden.ts`, and the request-owning hooks.

Keep routine account controls **sign in**, **sign out**, **your gardens**, and **retry sign-in check**. Keep backup controls **backup & restore**, **download backup**, **choose a backup file**, **preview backup**, **restore copies**, and **cancel** direct. Match each label to the current stage rather than implying an upload or overwrite before it happens.

Preserve the current backup format and limits, fresh-link copy behavior, labelled restored entries, retry/resume semantics, sent/received classifications, and the distinction between device-only voice data and account storage. Show specific validation errors, current progress, completed copies, and recoverable failures. Do not replace these with botanical jokes or a generic “all restored” confirmation.

Error copy uses the factual failure followed by the next action. Only mention preserved content where the current flow guarantees it:

| Situation                                         | Final copy                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Initial generation unavailable                    | Couldn’t grow the garden right now. Your note is still here. Try again.               |
| Garden link could not be saved                    | Couldn’t save the garden link. Your note is still here. Try again.                    |
| Regrow failed                                     | Couldn’t grow different flowers. Your previous garden is still available.             |
| No design returned / invalid design               | Couldn’t finish this garden. Your note is still here. Try again.                      |
| Service busy                                      | Garden growing is busy right now. Try again in a moment.                              |
| Request rate limit                                | Too many requests just now. Wait a little and try again.                              |
| Daily service limit                               | Garden growing has reached its daily limit. Your note is still here. Try again later. |
| Network error                                     | Couldn’t reach Bloomnote. Check your connection and try again.                        |
| Timeout                                           | That took too long. Your note is still here. Try again.                               |
| Copy link failed                                  | Couldn’t copy the link. Select it above to copy it yourself, or try again.            |
| Native sharing failed                             | Couldn’t open sharing. Copy the link instead.                                         |
| Image save failed                                 | Couldn’t save the image. Try again, or use the garden link.                           |
| Account-library load failed                       | Couldn’t load your gardens. Try again. Your saved links are unchanged.                |
| Account removal failed and was rolled back        | Couldn’t remove that garden. It’s back in your library. Try again.                    |
| Sign-in check failed with local entries available | Couldn’t check your sign-in. Only gardens saved on this device are shown.             |
| Garden load failed                                | Couldn’t load this garden. Check your connection or try again.                        |
| Garden definitely missing                         | This garden couldn’t be found. Check the link with the person who sent it.            |

Keep failure classification and analytics stable. Review both low-level errors and the hooks/components that display them. Do not expose raw model errors or note contents. Avoid asking someone to improve or lengthen their personal note to fix a server/model failure.

The garden-load screen currently describes a “connection hiccup, not a bad link”. Replace that certainty unless the actual response establishes it. Do not convert every failed read into a missing garden or an empty library.

Existing privacy disclosures about Gemini, storage, shared links, scheduled presentation, local recordings, and account collections remain accurate and visible. Keep retention and legal statements substantively unchanged. This is not a revision of legal terms or sharing permissions.

**17. Generated writing, metadata, and documentation**

Keep the generation prompt and mood prompt hints unchanged in this pass. `packages/api/src/prompt.ts` already asks for the sender’s own register, specific details, real flowers, restrained sympathy, and no invented personal facts. Do not force dry humor into every generated note or rewrite existing gifts.

The UI prompt labels and the examples above can change without changing model instructions. Production generation remains separate from testing. This copy pass does not need real Gemini evaluation calls or quota spending; use the repository’s isolated fixtures and request stubs. A later prompt change needs its own evidence and the documented evaluation workflow.

Public surfaces:

| Surface                             | Final copy                                                  |
| ----------------------------------- | ----------------------------------------------------------- |
| Homepage title                      | Bloomnote · A note. With flowers.                           |
| Homepage/social/install description | Write someone a note. We’ll grow a garden from the details. |
| Social title                        | Bloomnote · A note. With flowers.                           |
| Install shortcut                    | Write a note                                                |
| Install shortcut description        | Open your note, including any saved draft.                  |
| Garden title                        | A garden for {recipient} · Bloomnote                        |
| Recipient fallback title            | A garden for you · Bloomnote                                |
| Library title                       | Your gardens · Bloomnote                                    |

Keep personal note and secret contents out of browser titles and generic metadata. Keep no-index/private-route handling, per-garden image access, and write-once image rules unchanged.

Update `packages/web/index.html`, the install manifest, and any relevant text in the social-image source. If the image text changes, regenerate its PNG using the existing generator and inspect it. Preserve icon identities, install shortcuts, and valid screenshot declarations.

Reconcile the README, [design guide](../DESIGN.md), help text, calendar prose, image captions, accessibility labels, browser fixtures, and curated screenshots with the final wording. Use synthetic data for screenshots. If a fresh capture is blocked, state that and remove or explicitly identify obsolete documentation embeds; do not silently present old copy as the new interface or delete original assets unnecessarily.

**18. Implementation order and ownership**

| Pass                              | Source areas                                                                                                                                                                                                                   | Result                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Shared editorial rules            | `lib/occasions.ts`, `lib/rituals.ts`, `lib/placeholders.ts`, `lib/moods.ts`                                                                                                                                                    | Stable labels and a single occasion-sensitive copy decision; every supplied prompt is covered.             |
| First impression                  | `ComposerFrame.tsx`, `Composer.tsx`, `NoteField.tsx`, `ComposerSecret.tsx`, `GardenForecastPanel.tsx`, `lib/gardenForecast.ts`                                                                                                 | Clear premise, supportive writing guidance, and consistent ordinary/sensitive context.                     |
| Demonstrations and growing        | `data/exampleGardens.ts`, `ExampleCarousel.tsx`, `lib/useHeroDemo.ts`, `GrowFeedback.tsx`, `lib/useGardenDesign.ts`, `ShareCard.tsx`                                                                                           | The examples demonstrate the voice and growing feedback fits the occasion.                                 |
| Receiving a gift                  | `RecipientView.tsx`, `RecipientHeader.tsx`, `BouquetNote.tsx`, `ComposerPreview.tsx`, `RemixContext.tsx`, `FlowerLegend.tsx`, `FlowerPeek.tsx`, `Watering.tsx`                                                                 | The sender’s actual words lead, with clear reveal and response actions.                                    |
| Sharing and timing                | `lib/useShareActions.ts`, `lib/useRecipientKeepsakes.ts`, `lib/gardenImage.tsx`, `lib/imageCards.tsx`, `lib/GardenDuetImage.tsx`, `ScheduleInput.tsx`, `ScheduleCalendar.tsx`, `SealedView.tsx`                                | Delivery, exports, cancellations, schedules, and reminders are described accurately.                       |
| Collections and memories          | `MyGardens.tsx`, `GardenLibraryShell.tsx`, `GardenRows.tsx`, `GardenRow.tsx`, `LibraryTabs.tsx`, `GardenLibraryHighlights.tsx`, `FlowerJournalShelf.tsx`, `VoiceRing.tsx`, `MemoryTrail.tsx`, relevant library/journal helpers | Empty states, privacy boundaries, optional reactions, and personal memories remain clear and low-pressure. |
| Supporting states and public copy | `BackupRestore.tsx`, `AuthNav.tsx`, `ErrorBoundary.tsx`, `LegalPage.tsx`, `Footer.tsx`, `AppUpdate.tsx`, `App.tsx`, `lib/designGarden.ts`, HTML, manifest, social-image source, README, design guide                           | Supporting screens and public descriptions agree with the product.                                         |

Single-use strings stay beside their component. Reuse narrow helpers for repeated states where useful. Do not add a translation framework, a global copy registry, a new design system, or unrelated API refactors.

Work on the checked-out branch. Apply and verify the change locally. Commit, push, and deployment are separate actions and are not part of this plan’s local implementation scope.

**19. Verification and acceptance**

Use the supported Node runtime and the package-manager version pinned in package.json, then run the repository’s required verification:

```sh
pnpm run verify
```

Use [quality checks](quality.md) and the [visitor walkthrough](visitor-review.md) for the local review. Browser journeys use isolated fixtures and must not create production gardens or call Gemini for this copy pass.

Update existing text expectations and accessible-name selectors deliberately. Preserve semantic assertions rather than replacing snapshots blindly. Relevant pure coverage already exists for placeholders, rituals, forecast behavior, design errors, sharing/image helpers, collections, backup, and saved garden data. Keep the repository’s current test architecture; do not add a DOM test framework for a copy pass.

Add focused tests for the shared occasion decision and cover it in the rendered browser journeys. Prove the new checks reject a sympathy/get-well screen that accidentally gets the ordinary joke, then restore the corrected source and verify the checks pass. Keep counter, date, account, failure, and data-preservation assertions meaningful.

| Review group        | Required cases                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Occasion and mood   | Every supported occasion with every mood; all alternate prompts for sympathy/get-well; unknown/missing occasion on a legacy garden.                                           |
| Writing             | First visit, saved draft, reply, empty/short/long note, long names, secrets, prompt insertion/cycling, clear and Undo.                                                        |
| Growing             | Real phase changes through fixtures, cancel, provider failure, quota/rate failure, save-link failure, reroll success and rollback.                                            |
| Sending             | Clipboard success/failure, native share resolution/cancellation/failure, selectable link, prepared images and failed exports.                                                 |
| Receiving           | Unopened, blooming, reduced motion, original note versus generated explanation, secret open/close, flower meanings, optional response, reply, replay, image/duet/print.       |
| Scheduling          | Local date/time, future/past/too-close values, schedule elapsed during generation, countdown, opening boundary, calendar download and reminder follow-up.                     |
| Library             | Account and device-only states, sent/received, empty/search-empty/pinned-empty, load failure, removal rollback, valid old links.                                              |
| Journal and backup  | Local meanings and recordings, microphone permission outcomes, save failure, quiet mode, backup preview, restore copies, partial retry, original links and content unchanged. |
| Presentation        | Desktop Chromium and phone-sized WebKit, short landscape viewport, enlarged text, long content, keyboard focus, reduced motion, screen-reader labels and status text.         |
| Public and exported | Metadata, manifest, social image, README/demo/install screenshots, image wrapping, correct names and dates, no private prose in generic titles.                               |

Read the complete composer-to-recipient flow aloud once. Keep the best existing text where it already works. A complete pass means every source area above was reviewed, the selected copy policy is consistent, stored personal content is intact, the final saved outputs agree, and any unavailable checks are explicitly reported. Remove obsolete task-created drafts and review artifacts according to the repository policy.

**20. Implementation and verification record**

The composer, supplied prompts, curated gardens, recipient reveal, sharing feedback, scheduling,
library, journal controls, error recovery, and public metadata now use this copy. The shared occasion
policy keeps sympathy and get-well guidance gentle across moods. Unknown occasions get neutral
supporting copy and a neutral prompt fallback. Existing gifts, private words, storage formats,
occasion/mood values, model instructions, and generation budgets remain unchanged.

Generation feedback reports choosing flowers and saving the link. Unknown model errors are replaced
with recovery copy, while their original cause remains available only for coarse error classification.
The evening sensitive invitation uses “there’s no set way to write this.” to avoid introducing an
expectation of perfection. Watering totals describe gestures rather than distinct people.

Completed local checks include frontend tests, build, type checking, lint, formatting, repository
structure and size checks, CSS checks, documentation checks, unused-code checks, and the bundle report.
A deliberately introduced ordinary joke on a sensitive growing screen failed the new regression check;
the correct component was restored and the frontend suite passed again. Browser assertions were updated
and occasion-sensitive composer journeys were added.

Full verification remains unavailable in this environment:

- The dependency audit cannot reach the npm registry because DNS resolution fails.
- Worker tests and browser journeys cannot start their local runtime because binding to loopback ports
  is denied. The browser-fixture guard cases that need local servers have the same limitation; the
  documentation guard cases pass.
- The available Node runtime is outside the supported range pinned in package.json. The supported
  runtime still needs the complete verification run.
- Desktop/phone visual review, native sharing, exported-image raster review, and fresh screenshot
  captures remain unverified. The old README image embed was removed; original curated images and
  install screenshots are preserved. README identifies the install previews as predating this copy.

The homepage social-image source contains only the wordmark, so its PNG did not require regeneration.
Validation was completed before the separately authorized commit and push. No deployment command was run.

The reapply preserves the updated letter layout, recipient folio, personalized grow action, and
separate voice-memory owner. The letter’s salutation remains “Dear” with its accessible “to” label.
Composer copy is passed through the letter and options components; the growing panel keeps its
scene and original note. The reapply passed the available source checks, build and frontend tests after an offline frozen
install synchronized the pulled dependencies. The regression proof was repeated against the new
growing panel, restored, and followed by a passing frontend suite. The complete verification command,
Worker tests, browser-fixture guard tests and browser journeys were attempted again and hit the
network/local-port limits above.
