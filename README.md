# Innovo Labs — Power Pages

Source for the Innovo Labs innovation-programme microsite, built on Microsoft Power Pages (enhanced data model). Employees read programme content, submit ideas, and track the status of their own submissions.

The site is server-rendered by Liquid web templates reading Dataverse through `{% fetchxml %}`. Idea submission posts to a Power Automate flow, which writes to SharePoint and Dataverse and sends confirmation and status emails.

```
Employee ──► Power Pages site ──► Dataverse (content, ideas, activity)
                   │
                   └─ submit form ──HTTP POST──► Power Automate
                                                  ├─► SharePoint list  (programme team's working record)
                                                  ├─► Dataverse        (what the site reads back)
                                                  └─► Outlook          (confirmation + status emails)
```

## Repository layout

Mirrors the layout produced by `pac pages download`, pruned to what was authored for this site.

| Path | Contents |
|---|---|
| `web-templates/` | Thirteen Liquid templates — page bodies, shared head/foot, and the news and partner card partials |
| `web-files/` | `innovo-labs.css` and `innovo-labs.js`, with their web-file metadata |
| `web-pages/` | Page records and routing |
| `page-templates/` | Page-template records binding pages to web templates |
| `table-permissions/` | Dataverse table permissions per web role |
| `content-snippets/`, `weblink-sets/` | Site-level content records |
| `flows/` | The four Power Automate flow definitions, exported from the `InnovoLabsMicrosite` solution |
| `*.yml` | Website, languages, publishing states, site markers, site settings, web roles, page access rules |

### Web templates

| Template | Page |
|---|---|
| `innovo-labs-head` / `innovo-labs-foot` | Shared document head, navigation and footer, included by every page |
| `innovo-labs-home` | Landing page — hero, campaign panel, tracker snapshot, news, partners, quotes |
| `innovo-tracker` | Innovation tracker — adopted, in-flight and on-radar initiatives |
| `innovo-news-hub` / `innovo-news-detail` / `innovo-news-card` | News listing, article page, and the card partial used by both |
| `innovo-partnerships` / `innovo-partner-card` | Partner directory and card partial |
| `innovo-champions` | Labs Champions — the teams owning an initiative |
| `innovo-challenges` | Explore Challenges |
| `innovo-submit-idea` | Idea submission form (authenticated) |
| `innovo-my-ideas` | Submitter's own ideas and their activity trail (authenticated) |

## Data

Nine content tables in Dataverse, all prefixed `innovo_`: idea, idea activity, champion, leadership quote, live initiative, news post, partner, site config, tracker snapshot.

Reads happen at render time in Liquid. The news hub is the one exception: it server-renders the first page and pages further through the Power Pages Web API.

Ideas are written by the submission flow, not by the site. SharePoint is where the programme team works; Dataverse is what the site reads. A flow mirrors status changes and comments between them.

## Power Automate flows

Definitions in `flows/` are the standard export shape — `properties.connectionReferences` and `properties.definition` — pretty-printed for review.

| Flow | Trigger | Does |
|---|---|---|
| `idea-submission` | HTTP request from the form | Creates the SharePoint item, resolves the submitter's contact, creates the Dataverse row, sends the confirmation email |
| `idea-status-update` | SharePoint item modified | Updates the Dataverse status, logs an activity, sends the status email |
| `idea-activity-sync` | SharePoint item created | Mirrors reviewer comments into Dataverse activity rows |
| `recount-ideas` | Dataverse idea created, updated or deleted | Rewrites the submitted-ideas count on the tracker snapshot |

`idea-status-update` ends by writing a "status notified" field back to SharePoint, which re-triggers it. A condition at the top catches the second run and stops; without it the flow would loop.

Two field limits shape the submission form: the SharePoint built-in `Title` column is fixed at 255 characters, and a Dataverse Text column at 4000. The form caps its inputs to match, since a value over either limit fails the create silently from the submitter's side.

**On import**, connection references must be bound to connections in the target environment, and the form's `FLOW_URL` set to the new HTTP trigger address. The SharePoint site in `dataset` values is a placeholder.

## Security model

- Sign-in is Microsoft Entra ID only; local sign-in is disabled.
- `Submit an Idea` and `My Ideas` require the Authenticated Users web role. Everything else is anonymous.
- `innovo_idea` is scoped to **Contact** — a person sees only their own submissions. `innovo_ideaactivity` inherits through its parent idea. Content tables are global read.

See `table-permissions/`, `webrole.yml` and `webpagerule.yml`.

## Configuration

Two values are deliberately absent from source control.

**`FLOW_URL`** in `innovo-submit-idea` is the Power Automate HTTP-trigger address. It carries a shared access signature — anyone holding it can invoke the flow without signing in — so it is set on the live site and committed here as an empty string.

**The Entra tenant ID** in the sign-in authority (`Authentication/Registration/LoginButtonAuthenticationType` in `sitesetting.yml`) is replaced with `<tenant-id>`.

## Conventions

These are Power Pages behaviours that shaped the code, not stylistic choices.

**Liquid tags open and close on the same line.** Power Pages fails to parse a tag split across lines. One-line `{% for %}…{% endfor %}` loops look cramped for this reason.

**Fetchxml throws on a missing attribute**, and the error surfaces wherever the results are first used — which can be most of a page. Removing a column from a table takes down every template that names it.

**Fetchxml results are cached per query text.** Two templates asking the same question with different column lists get separate cache entries and can return different answers. `innovo-labs-home` and `innovo-tracker` therefore issue a byte-identical initiatives query.

**Comments carry the reasoning.** Non-obvious decisions are explained inline where they were made.

## Deployment

Requires the [Power Platform CLI](https://learn.microsoft.com/power-platform/developer/cli/introduction).

```sh
pac auth create --environment <environment-url>
pac pages upload --path . --modelVersion 2
```

`pac pages upload` merges into the target site by record ID; it never deletes. Confirm the active profile with `pac org who` before any write, and confirm `website.yml` names the site that holds the domain binding — an ID that does not exist in the target creates a new site record.

## Not included

- Media — images, fonts and video web files. They are referenced by URL from Dataverse rows and site config.
- Microsoft's default web templates, web files and the `.portalconfig` deployment manifest.
- Dataverse table schema and connection definitions — those live in the environment's solution.
