"use client"

import * as React from "react"
import {
  Sun,
  Moon,
  Cloud,
  CloudRain,
  Snowflake,
  CloudLightning,
  CloudFog,
  Thermometer,
  MapPin,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

type WeatherType =
  | "clear"
  | "clouds"
  | "rain"
  | "snow"
  | "thunderstorm"
  | "mist"
  | "unknown"

type WeatherData = {
  city: string
  temperature: number
  weatherType: WeatherType
  dateTime: string
  isDay: boolean
}

type ForecastDay = {
  date: string        // e.g. "Thu, Apr 17"
  dayShort: string    // e.g. "Thu"
  minTemp: number
  maxTemp: number
  weatherType: WeatherType
  isDay: boolean
}

type WeatherApiResponse = {
  name: string
  main: { temp: number }
  weather: Array<{ main: string; icon: string }>
}

type ForecastApiResponse = {
  list: Array<{
    dt: number
    main: { temp_min: number; temp_max: number; temp: number }
    weather: Array<{ main: string; icon: string }>
    dt_txt: string
  }>
}

type WeatherWidgetProps = {
  apiKey?: string
  className?: string
  width?: string
  location?: { latitude: number; longitude: number }
}

function mapWeatherType(condition: string): WeatherType {
  const v = condition.toLowerCase()
  if (v.includes("clear")) return "clear"
  if (v.includes("cloud")) return "clouds"
  if (v.includes("rain") || v.includes("drizzle")) return "rain"
  if (v.includes("snow")) return "snow"
  if (v.includes("thunder")) return "thunderstorm"
  if (v.includes("mist") || v.includes("fog") || v.includes("haze")) return "mist"
  return "unknown"
}

function WeatherIcon({ type, isDay, size = "md" }: { type: WeatherType; isDay: boolean; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-4 w-4" : "h-8 w-8"
  switch (type) {
    case "clear":
      return isDay ? <Sun className={`${cls} text-amber-400`} /> : <Moon className={`${cls} text-slate-300`} />
    case "clouds":
      return <Cloud className={`${cls} text-slate-400`} />
    case "rain":
      return <CloudRain className={`${cls} text-blue-400`} />
    case "snow":
      return <Snowflake className={`${cls} text-cyan-300`} />
    case "thunderstorm":
      return <CloudLightning className={`${cls} text-yellow-400`} />
    case "mist":
      return <CloudFog className={`${cls} text-slate-400`} />
    default:
      return <Thermometer className={`${cls} text-slate-400`} />
  }
}

export function WeatherWidget({ apiKey, className = "", width = "16rem", location }: WeatherWidgetProps) {
  const [weather, setWeather] = React.useState<WeatherData | null>(null)
  const [forecast, setForecast] = React.useState<ForecastDay[]>([])
  const [loading, setLoading] = React.useState(false)
  const [forecastLoading, setForecastLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState(false)

  const getCoords = React.useCallback(() => ({
    lat: location?.latitude ?? 19.076,
    lon: location?.longitude ?? 72.8777,
  }), [location])

  const fetchWeather = React.useCallback(async () => {
    if (!apiKey) { setError("Missing OpenWeather API key"); return }
    const { lat, lon } = getCoords()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      )
      if (!res.ok) throw new Error("Failed to fetch weather")
      const data: WeatherApiResponse = await res.json()
      const now = new Date()
      setWeather({
        city: data.name,
        temperature: Math.round(data.main.temp),
        weatherType: mapWeatherType(data.weather[0]?.main || ""),
        dateTime: now.toLocaleString([], {
          weekday: "short", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit",
        }),
        isDay: (data.weather[0]?.icon || "").includes("d"),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [apiKey, getCoords])

  const fetchForecast = React.useCallback(async () => {
    if (!apiKey || forecast.length > 0) return
    const { lat, lon } = getCoords()
    setForecastLoading(true)
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      )
      if (!res.ok) throw new Error("Forecast unavailable")
      const data: ForecastApiResponse = await res.json()

      // Group 3-hour slots by day, pick min/max temp and dominant condition
      const dayMap = new Map<string, { mins: number[]; maxs: number[]; conditions: string[]; icons: string[] }>()
      const today = new Date().toDateString()

      for (const item of data.list) {
        const d = new Date(item.dt * 1000)
        const key = d.toDateString()
        if (key === today) continue // skip today
        if (!dayMap.has(key)) dayMap.set(key, { mins: [], maxs: [], conditions: [], icons: [] })
        const entry = dayMap.get(key)!
        entry.mins.push(item.main.temp_min)
        entry.maxs.push(item.main.temp_max)
        entry.conditions.push(item.weather[0]?.main || "")
        entry.icons.push(item.weather[0]?.icon || "")
      }

      const days: ForecastDay[] = []
      for (const [dateStr, vals] of dayMap.entries()) {
        if (days.length >= 5) break
        const d = new Date(dateStr)
        // Pick most frequent condition
        const freq = vals.conditions.reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc }, {} as Record<string, number>)
        const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]
        // Use midday icon to determine day/night
        const middayIcon = vals.icons[Math.floor(vals.icons.length / 2)] || ""
        days.push({
          date: d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }),
          dayShort: d.toLocaleDateString([], { weekday: "short" }),
          minTemp: Math.round(Math.min(...vals.mins)),
          maxTemp: Math.round(Math.max(...vals.maxs)),
          weatherType: mapWeatherType(dominant),
          isDay: middayIcon.includes("d"),
        })
      }
      setForecast(days)
    } catch {
      // silently fail forecast — current weather still shows
    } finally {
      setForecastLoading(false)
    }
  }, [apiKey, getCoords, forecast.length])

  React.useEffect(() => { fetchWeather() }, [fetchWeather])

  const handleToggle = () => {
    const next = !expanded
    setExpanded(next)
    if (next) fetchForecast()
  }

  return (
    <div
      className={`rounded-2xl border border-[#E5E5EA] bg-white/90 backdrop-blur-sm shadow-md overflow-hidden transition-all duration-300 ${className}`}
      style={{ width }}
    >
      {/* Current weather — always visible */}
      <button
        className="w-full text-left p-4 hover:bg-[#F5F5F7] transition-colors"
        onClick={handleToggle}
        aria-label={expanded ? "Collapse forecast" : "Show 5-day forecast"}
      >
        {loading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[#86868B]" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-red-500">{error}</p>
            <button
              onClick={(e) => { e.stopPropagation(); fetchWeather() }}
              className="rounded-full p-1 hover:bg-[#E5E5EA]"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#86868B]" />
            </button>
          </div>
        ) : weather ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <WeatherIcon type={weather.weatherType} isDay={weather.isDay} size="md" />
              <div>
                <div className="text-2xl font-light text-[#1D1D1F] leading-none">
                  {weather.temperature}<span className="text-base">°C</span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-[#86868B]">
                  <MapPin className="h-2.5 w-2.5" />
                  {weather.city}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-[10px] text-[#86868B] text-right leading-tight">
                {weather.dateTime.split(",").slice(0, 2).join(",")}
              </div>
              <div className="text-[10px] text-[#86868B]">
                {weather.dateTime.split(",").slice(-1)[0]?.trim()}
              </div>
              {expanded
                ? <ChevronUp className="h-3 w-3 text-[#86868B] mt-0.5" />
                : <ChevronDown className="h-3 w-3 text-[#86868B] mt-0.5" />
              }
            </div>
          </div>
        ) : null}
      </button>

      {/* 5-day forecast — expands on click */}
      {expanded && (
        <div className="border-t border-[#E5E5EA] px-4 py-3">
          {forecastLoading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-[#86868B]" />
            </div>
          ) : forecast.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-widest text-[#86868B] font-semibold mb-2">5-Day Forecast</p>
              {forecast.map((day) => (
                <div key={day.date} className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#1D1D1F] w-8">{day.dayShort}</span>
                  <WeatherIcon type={day.weatherType} isDay={day.isDay} size="sm" />
                  <div className="flex items-center gap-2 text-xs text-[#86868B]">
                    <span className="text-[#1D1D1F] font-medium">{day.maxTemp}°</span>
                    <span>{day.minTemp}°</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#86868B] text-center py-2">Forecast unavailable</p>
          )}
        </div>
      )}
    </div>
  )
}
