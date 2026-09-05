# Sources

This folder serves as the single source of truth for all local game data required by the mobile app (from Game Boy up to Nintendo DS: Gen 1 through Gen 5).

## Directory Structure

```text
mobile/sources/
├── README.md
├── sprites/
│   ├── static/
│   │   ├── regular/               # Static PNG sprites (1.png ... 649.png)
│   │   └── shiny/                 # Static Shiny PNG sprites (1.png ... 649.png)
│   └── animated/
│       ├── regular/               # Animated GIF sprites (1.gif ... 649.gif)
│       └── shiny/                 # Animated Shiny GIF sprites (1.gif ... 649.gif)
├── gen1/
│   ├── base_stats.json            # Base stats & metadata for Gen 1 (151 Pokémon, including 'special' stat)
│   └── movesets.json              # Gen 1 level-up movesets
├── gen2/
│   ├── base_stats.json            # Base stats & metadata for Gen 2 (251 Pokémon)
│   └── movesets.json              # Gen 2 level-up movesets
├── gen3/
│   ├── base_stats.json            # Base stats & metadata for Gen 3 (386 Pokémon)
│   └── movesets.json              # Gen 3 level-up movesets
├── gen4/
│   ├── base_stats.json            # Base stats & metadata for Gen 4 (493 Pokémon)
│   └── movesets.json              # Gen 4 level-up movesets
├── gen5/
│   ├── base_stats.json            # Base stats & metadata for Gen 5 (649 Pokémon)
│   └── movesets.json              # Gen 5 level-up movesets
├── base_stats.json                # Consolidated master base stats & species metadata (#1 to #649)
├── movesets.json                  # Consolidated level-up movesets indexed by generation ('gen1'..'gen5')
└── moves.json                     # Complete move catalog (name, type, power, accuracy, PP, priority)
```

## Data Schema

### `base_stats.json`
Keyed by National Pokédex ID (as a string/integer):
```json
{
  "25": {
    "id": 25,
    "identifier": "pikachu",
    "name": "Pikachu",
    "height": 4,
    "weight": 60,
    "base_experience": 112,
    "types": ["electric"],
    "stats": {
      "hp": 35,
      "attack": 55,
      "defense": 40,
      "special_attack": 50,
      "special_defense": 50,
      "speed": 90,
      "special": 50
    },
    "generation": 1,
    "capture_rate": 190,
    "base_happiness": 70,
    "growth_rate_id": 2,
    "gender_rate": 4
  }
}
```

### `movesets.json`
Keyed by Pokémon ID, providing an ordered list of moves learned on level up:
```json
{
  "25": [
    {
      "level": 1,
      "move_id": 84,
      "identifier": "thunder-shock",
      "name": "Thunder Shock",
      "type": "electric",
      "power": 40,
      "accuracy": 100,
      "pp": 30
    },
    {
      "level": 6,
      "move_id": 39,
      "identifier": "tail-whip",
      "name": "Tail Whip",
      "type": "normal",
      "power": null,
      "accuracy": 100,
      "pp": 30
    }
  ]
}
```

## Generation Coverage
- **Gen 1 (Game Boy)**: Pokémon #1 – #151 (Red/Blue/Yellow)
- **Gen 2 (Game Boy Color)**: Pokémon #1 – #251 (Gold/Silver/Crystal)
- **Gen 3 (Game Boy Advance)**: Pokémon #1 – #386 (Ruby/Sapphire/Emerald/FireRed/LeafGreen)
- **Gen 4 (Nintendo DS)**: Pokémon #1 – #493 (Diamond/Pearl/Platinum/HeartGold/SoulSilver)
- **Gen 5 (Nintendo DS)**: Pokémon #1 – #649 (Black/White/Black 2/White 2)
