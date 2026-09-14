# Outside Card

A Home Assistant dashboard card showing the time and the outdoor temperature,
large enough to read across a room:

- **Clock and date** at the top.
- **The temperature**, coloured by how warm it is, with how much it has moved
  in the last hour.
- **A sky that follows the sun.** The sun travels its arc from sunrise to
  sunset, then the moon and stars take over, with a warm glow at dawn and dusk.
- **A thermometer** marking the last 24 hours' low and high.
- **Humidity, sunrise and sunset** in a row below.
- **The last 24 hours as a chart**, coloured by temperature, with the night
  hours shaded.

<p>
  <img src="https://raw.githubusercontent.com/rumpushome/outside-card/main/images/preview.png" width="49%" alt="Outside Card by day">
  <img src="https://raw.githubusercontent.com/rumpushome/outside-card/main/images/preview-night.png" width="49%" alt="Outside Card at night">
</p>

It pairs with the [Solar Geyser Card](https://github.com/rumpushome/solar-geyser-card),
which is drawn in the same sky.

## Install

### HACS

[![Open this repository in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=rumpushome&repository=outside-card&category=plugin)

Or add it by hand:
1. Go to **HACS → ⋮ → Custom repositories**.
2. Paste `https://github.com/rumpushome/outside-card` and choose type **Dashboard**.
3. Download **Outside Card**. HACS adds the dashboard resource for you.

### Manual

1. Download `outside-card.js` from the
   [latest release](https://github.com/rumpushome/outside-card/releases/latest)
   and copy it into `config/www/`.
2. **Settings → Dashboards → ⋮ → Resources → + Add Resource**
   - URL: `/local/outside-card.js?v=1`
   - Type: **JavaScript Module**
3. Hard-refresh, then **+ Add Card** → **Outside Card**.

> Bump the `?v=` number every time you replace the file.

## Example configuration

```yaml
type: custom:outside-card
entity: sensor.outdoor_temperature
humidity_entity: sensor.outside_humidity
sun_entity: sun.sun
locale: en-GB
time_format: 24
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `entity` | **required** | Outdoor temperature. °C or °F. |
| `humidity_entity` | – | Adds a humidity column to the row below the sky. |
| `sun_entity` | `sun.sun` | Drives the sky, the sunrise/sunset columns and the night shading on the chart. Without it the sky stays daytime and those parts disappear. |
| `feels_like_entity` | – | Adds "Feels like 5°" in front of the change-in-the-last-hour line. |
| `aqi_entity` | – | Adds an air-quality column with Good / Moderate / Poor. |
| `name` | `Outside` | The small label above the temperature. |
| `show_clock` | `true` | Turn off to hide the clock and date. |
| `time_format` | `24` | `24` or `12`. |
| `locale` | HA's language | Language for the date, e.g. `en-GB` for "Saturday 12 September". |
| `round` | `1` | Decimal places for the temperature. |
| `hours_to_show` | `24` | How much history the chart and the low/high cover. |
| `min` / `max` | `0` / `40` (°F: `30` / `110`) | The thermometer's scale. |
| `animate` | `true` | The sun's rays, twinkling stars and the "now" pulse. |

All of these are in the visual editor too.

## Where the numbers come from

- **The temperature** is the sensor's current reading.
- **The change in the last hour** compares it with the reading an hour ago.
- **Low and high** are the lowest and highest readings over the chart's time
  range, counting the reading that was current when the range started.
- **History** comes from Home Assistant's recorder when the card loads and every
  10 minutes after. New readings are added in between, so the right-hand end of
  the chart always matches the number on screen.
- **The sun's position** comes from `sun.sun`'s next sunrise and sunset, so it's
  right wherever you live, with no setup.

## Colour

The temperature, the thermometer, the chart line and the low/high markers all use
one colour scale: icy blue below 5°, then cyan, green around 18°, amber around 24°
and red from the mid-30s. °F sensors are converted only to pick the colour.

The sky part is always dark. The row below it and the chart follow your theme's
text and divider colours.

## Sizing

The card is one drawing that scales with its width, keeping its proportions
(600 × 680). At a 616px dashboard column it's about 700px tall.

## Troubleshooting

**Card doesn't appear**
The resource isn't loading. Check the URL and that the type is *JavaScript
Module*. The browser console logs `OUTSIDE-CARD v1.0.1` when the card loads.

**Chart says "Not enough history yet"**
The recorder has no history for the sensor. Check it isn't excluded in the
`recorder:` settings. The chart fills in as readings arrive.

**Date is in the wrong order** ("Saturday, September 12")
Set `locale: en-GB`, or whichever language you want.

**Sky never goes dark**
`sun.sun` is missing (the Sun integration is off), or `sun_entity` points
somewhere else.

## Licence

[MIT](LICENSE)
