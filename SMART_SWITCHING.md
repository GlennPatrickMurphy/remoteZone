# 🧠 Smart Channel Switching - New Features!

## 🎉 **What's New:**

I just added intelligent channel switching that goes way beyond just redzone detection!

### **New Features:**

1. ⏸️ **Timeout Avoidance** - Automatically switches away during timeouts
2. 🔥 **Excitement Scoring** - Prioritizes close, high-scoring games in the 4th quarter
3. 🎯 **Dynamic Priority** - Base priority adjusts based on game situation
4. ⏱️ **Period Detection** - Avoids end-of-quarter dead time
5. 🔄 **Smart Return** - Goes back after timeout if team is in redzone

## 📋 **How It Works:**

### **1. Timeout Detection ⏸️**

**What happens:**
- System detects timeout from play-by-play ("Timeout" in play text)
- Marks game as `is_timeout = true`
- Starts 3-minute timer

**Channel switching:**
```
Current: Ch 8 (Dallas vs Washington)
Play: "Timeout Dallas"
Action: Switch to Ch 516 (Colts vs Chargers) - NO timeout!
Log: "⏸️ Timeout on Ch 8 - Switching to Ch 516"
```

**After 3 minutes:**
- Timeout expires automatically
- If Dallas is in redzone → Switch back to Ch 8
- If not → Stay on current game

### **2. Excitement Scoring 🔥**

**Formula:**
```python
excitement = 0

# Close game (within 10 points)
if score_diff <= 10:
    excitement += (10 - score_diff) * 2  # 0-20 points

# High scoring
if total_score > 40:
    excitement += (total_score - 40) * 0.5

# Last 15 min of 4th quarter
if Q4 and time_remaining <= 15:
    excitement += (15 - time_remaining) * 3  # Up to 45 points
```

**Example:**
```
Game: Dallas 27, Washington 24 (Q4, 5:00 left)
Score diff: 3 points → (10-3)*2 = 14 points
Total score: 51 → (51-40)*0.5 = 5.5 points
Q4 time: 5 min left → (15-5)*3 = 30 points
Total excitement: 49.5 points!
```

### **3. Priority Calculation 🎯**

**Scoring system:**

| Factor | Points | Description |
|--------|--------|-------------|
| **Redzone** | 1000+ | Massive bonus, always wins |
| Yards to goal | 0-300 | Closer = more points |
| Excitement | 0-60 | Close Q4 games |
| Base priority | 50-450 | Your configured priority |
| Current channel | +5 | Avoid unnecessary switching |

**Example Decision:**
```
Ch 516: Colts in redzone at 5yd = 1000 + 250 + 450 = 1700 points
Ch 8:   Dallas 27-24, Q4 5min = 0 + 50 + 400 = 450 points
Ch 22:  Giants 10-3, Q2 = 0 + 0 + 350 = 350 points

Winner: Ch 516 (Redzone always wins!)
```

**Without redzone:**
```
Ch 516: Colts 35-14, Q3 = 0 + 7.5 + 450 = 457.5 points
Ch 8:   Dallas 27-24, Q4 5min = 0 + 49.5 + 400 = 449.5 points
Ch 22:  Giants 30-28, Q4 2min = 0 + 55 + 350 = 405 points

Winner: Ch 516 (Highest priority + decent excitement)
```

**But if excitement high enough:**
```
Ch 516: Colts 35-14, Q3 = 457.5 points
Ch 8:   Dallas 28-27, Q4 1min = 0 + 59 + 400 = 459 points ← WINS!
Ch 22:  Giants 30-28, Q4 2min = 405 points

Winner: Ch 8 (Excitement overcomes base priority!)
```

### **4. End of Period Detection 📅**

**Detects:**
- Clock at 0:00
- "End of quarter" in play text
- "End of half" in play text

**Action:**
```
Ch 8: End of 2nd quarter
→ Switch to active game (Ch 516)
→ Return when 3rd quarter starts
```

### **5. Smart Return Logic 🔄**

**Scenario:**
```
19:05:00 - Dallas in redzone at WSH 15
19:05:05 - 📺 Changed to Ch 8
19:05:30 - Timeout Dallas
19:05:35 - ⏸️ Timeout on Ch 8 - Switching to Ch 516
19:06:00 - [Watching Colts game for 3 minutes]
19:08:35 - [Timeout expires]
19:08:40 - Dallas still in redzone at WSH 12
19:08:45 - 🔴 Dallas in REDZONE - Ch 8
19:08:50 - 📺 Changed back to Ch 8
```

## 🎮 **What You'll See:**

### **Activity Log Messages:**

**Redzone:**
```
🔴 REDZONE Dallas Cowboys at 11yd - Ch 8 (score: 1250)
```

**Excitement:**
```
🔥 Close game Q4 5.0min (27-24) - Ch 8 (score: 459)
```

**Timeout:**
```
⏸️ Timeout on Ch 8 - Switching to Ch 516
```

**Normal Switch:**
```
📺 Changed to channel 516
```

### **Game Cards Show:**

```
Washington Commanders @ Dallas Cowboys
Channel: 8    Priority: 2
Score: 24-27   Quarter: 4   Clock: 5:00
Yards to Endzone: 15    Excitement: 49.5

Last Play: C.Prescott pass complete to C.Lamb for 8 yards
🔴 REDZONE: Dallas Cowboys
⏸️ TIMEOUT
```

## 📊 **Decision Tree:**

```
Is there a redzone game?
├─ YES → Is it on timeout?
│  ├─ YES → Pick next best redzone game
│  └─ NO → Pick that game! (1000+ points)
└─ NO → Are we on timeout/end of period?
   ├─ YES → Switch to any active game
   └─ NO → Calculate excitement scores
      └─ Pick highest score (excitement + priority)
```

## 🧪 **Example Session:**

```
19:00:00  🏈 Monitoring started!
19:00:05  Checking games...
19:00:10  🔴 REDZONE Dallas Cowboys at 22yd - Ch 8 (score: 1280)
19:00:15  📺 Changed to channel 8

[Watching Dallas drive]

19:02:30  Timeout Dallas detected
19:02:35  ⏸️ Timeout on Ch 8 - Switching to Ch 516
19:02:40  📺 Changed to channel 516

[Watching Colts for 3 minutes]

19:05:35  Timeout expired
19:05:40  🔴 REDZONE Dallas Cowboys at 8yd - Ch 8 (score: 1320)
19:05:45  📺 Changed to channel 8

[Back to Dallas - they score!]

19:06:20  No redzone activity
19:06:25  Checking games...
19:06:30  🔥 Close game Q4 3.5min (30-28) - Ch 22 (score: 455)
19:06:35  📺 Changed to channel 22

[Close Giants game in final minutes!]
```

## ⚙️ **Customization:**

Want to adjust the behavior? Here are the key values in `web_controller.py`:

### **Timeout Duration:**
```python
if time.time() - game.timeout_start_time > 180:  # 3 minutes
```
Change `180` to adjust timeout length (in seconds)

### **Excitement Thresholds:**
```python
if score_diff <= 10:  # Within 10 points
if total_score > 40:  # High scoring threshold
if time_remaining_minutes <= 15:  # Last 15 minutes
```

### **Scoring Weights:**
```python
score += 1000  # Redzone base
score += (30 - yards) * 10  # Closer to goal
excitement += (10 - diff) * 2  # Close game
excitement += (15 - time) * 3  # Late game
```

## 🎯 **Best Use Cases:**

### **Sunday Afternoon:**
- Multiple games, some blowouts, some close
- System intelligently picks most exciting
- Avoids commercial timeouts

### **Prime Time:**
- Close game in 4th quarter
- System stays locked on that game
- Only switches for redzone

### **Multi-Game Redzone:**
- Multiple teams in redzone
- System picks closest to scoring
- Then switches to next redzone

---

## 🚀 **Ready To Test!**

**Refresh http://localhost:8080 and start monitoring!**

You'll now see:
- ✅ Automatic timeout avoidance
- ✅ Smart prioritization of close games
- ✅ Intelligent switching between action
- ✅ Return to redzone after timeouts

**It's like having your own personal RedZone channel! 🏈📺**
