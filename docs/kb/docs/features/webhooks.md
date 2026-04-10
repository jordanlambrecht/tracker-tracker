---
title: Webhooks
description: Get alerts in Discord when your ratio drops, a tracker goes down, or you hit a milestone.
---

# Webhooks

Tracker Tracker sends you alerts when things change on your trackers — ratio drops, hit-and-runs, outages, rank changes, and more.

## Supported Platforms

| Platform | Status    |
| -------- | --------- |
| Discord  | Supported |
| Slack    | Planned   |
| Telegram | Planned   |
| Gotify   | Planned   |
| ntfy     | Planned   |

## Setting Up Discord

### In Discord

1. Open the channel where you want alerts
2. **Edit Channel → Integrations → Webhooks → New Webhook**
3. Name it (i.e., "Tracker Alerts")
4. Copy the webhook URL

Keep this URL private — anyone with it can post to your channel.

![Discord webhook setup showing name and channel](../assets/images/webhooks-discord-setup.png)

### In Tracker Tracker

1. Go to **Settings → Notifications**
2. Click **Add Notification Target**
3. Select **Discord**, paste the URL, and name the target
4. Choose which events to send
5. Save and click **Test Webhook** to confirm

![Test notification in Discord](../assets/images/webhooks-discord-test-notif.png)

## Events

Each target subscribes to any combination of these events:

| Event            | Fires when                                       | Cooldown |
| ---------------- | ------------------------------------------------ | -------- |
| Ratio drop       | Ratio falls by ≥ 0.1 in one poll                 | 6 hours  |
| Hit-and-run      | H&R count goes up                                | 6 hours  |
| Tracker down     | A poll fails                                     | 6 hours  |
| Buffer milestone | Buffer crosses a threshold (default 10 GiB)      | 6 hours  |
| Account warned   | Account goes from not-warned to warned           | 6 hours  |
| Ratio danger     | Ratio drops below the tracker's required minimum | 24 hours |
| Zero seeding     | Tracker reports 0 active seeds                   | 24 hours |
| Rank change      | Your user class changes                          | 7 days   |
| Anniversary      | Membership hits 1 month, 6 months, then yearly   | 7 days   |

Cooldowns prevent spam. If a problem persists across multiple polls, you get one alert per cooldown period, not one for every single poll.

!!! info "First-poll behavior"
    Comparison events (ratio drop, hit-and-run) need two polls before firing. State events like "account warned" fire immediately if true on the first poll.

## Thresholds

Two thresholds can be adjusted per target:

| Threshold        | Default | What it controls                                             |
| ---------------- | ------- | ------------------------------------------------------------ |
| Ratio drop delta | 0.1     | How much the ratio must fall in one poll to trigger an alert |
| Buffer milestone | 10 GiB  | The buffer size that triggers a milestone alert when crossed |

## Scoping to Specific Trackers

By default, a target receives events from all trackers. You can limit it to specific trackers instead — events from others are ignored. Great for one Discord channel per tracker, or if you only want alerts for certain sites.

## Multiple Targets

Set up as many targets as you need:

- **One channel per tracker** — scope each target to a single tracker
- **Urgent vs. routine** — ratio danger and outages in one channel, rank changes and anniversaries in another
- **Private vs. shared** — disable "Include tracker name" on public channels

## Privacy

Use the **Include tracker name** toggle to hide the tracker name in messages if you share the Discord channel.

If you disable **Store usernames** in app settings, usernames are masked in alerts too.

Webhook URLs stay encrypted in the database — they never show up in API responses or logs.

## What the Messages Look Like

Notifications arrive as Discord embeds with a colored sidebar:

- **Red** — urgent: tracker down, hit-and-run, ratio below minimum, account warning
- **Amber** — caution: ratio drop, zero active seeds
- **Cyan** — positive: rank change, anniversary
- **Green** — milestone: buffer threshold crossed

## Troubleshooting

### Webhook shows "Failed"

Open the target card to see the error under the status badge. Common causes:

- **Webhook deleted in Discord.** Re-create it and update the URL in Tracker Tracker.
- **Channel deleted.** Discord removes all webhooks when a channel is deleted.
- **Network issue.** Transient problem. Click **Test Webhook** to retry.

### Notifications stopped arriving

After 3 failures, delivery pauses and then resumes on its own. If Discord was just temporarily down, you'll catch up on the next poll.

### Getting rate-limited

Discord allows roughly 30 webhook messages per minute per channel. To reduce volume:

- Increase your poll interval in **Settings → General**.
- Disable events you don't need.
- Spread targets across multiple Discord channels.

### Test works but real notifications don't

Real alerts require:

1. An actual event (ratio must drop, not just be low)
2. The cooldown to have passed since the last alert
3. Two polls for comparison events (ratio drop, hit-and-run)
