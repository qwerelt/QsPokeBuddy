import os
import io
import csv
import json
import urllib.request
import concurrent.futures

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES_DIR = os.path.join(BASE_DIR, 'sources')
SPRITES_DIR = os.path.join(SOURCES_DIR, 'sprites')

dirs = [
    os.path.join(SPRITES_DIR, 'static', 'regular'),
    os.path.join(SPRITES_DIR, 'static', 'shiny'),
    os.path.join(SPRITES_DIR, 'animated', 'regular'),
    os.path.join(SPRITES_DIR, 'animated', 'shiny')
]
for d in dirs:
    os.makedirs(d, exist_ok=True)
for gen in range(1, 6):
    os.makedirs(os.path.join(SOURCES_DIR, f'gen{gen}'), exist_ok=True)

CSV_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/'

def fetch_csv(name):
    url = CSV_BASE_URL + name
    print(f'Fetching {name}...')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp:
        text = resp.read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)

def download_sprite_item(item):
    poke_id, kind, url, dest = item
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return True
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        with open(dest, 'wb') as f:
            f.write(data)
        return True
    except Exception as e:
        print(f'Failed {kind} {poke_id}: {e}')
        return False

def download_all_sprites():
    targets = []
    for i in range(1, 650):
        # Static regular
        targets.append((i, 'static_regular', f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/{i}.png', os.path.join(SPRITES_DIR, 'static', 'regular', f'{i}.png')))
        # Static shiny
        targets.append((i, 'static_shiny', f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/shiny/{i}.png', os.path.join(SPRITES_DIR, 'static', 'shiny', f'{i}.png')))
        # Animated regular
        targets.append((i, 'animated_regular', f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/{i}.gif', os.path.join(SPRITES_DIR, 'animated', 'regular', f'{i}.gif')))
        # Animated shiny
        targets.append((i, 'animated_shiny', f'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/shiny/{i}.gif', os.path.join(SPRITES_DIR, 'animated', 'shiny', f'{i}.gif')))

    print(f'Downloading {len(targets)} sprites (regular & shiny, static & animated)...')
    with concurrent.futures.ThreadPoolExecutor(max_workers=35) as executor:
        results = list(executor.map(download_sprite_item, targets))
    print(f'Downloaded {sum(1 for r in results if r)} / {len(targets)} sprites.')

def main():
    print('Step 1: Downloading Sprites (Gen 1-5, Static & Animated, Regular & Shiny)...')
    download_all_sprites()

    print('\nStep 2: Fetching metadata CSVs from PokeAPI repository...')
    pokemon_rows = fetch_csv('pokemon.csv')
    species_rows = fetch_csv('pokemon_species.csv')
    pokemon_stats_rows = fetch_csv('pokemon_stats.csv')
    pokemon_types_rows = fetch_csv('pokemon_types.csv')
    types_rows = fetch_csv('types.csv')
    moves_rows = fetch_csv('moves.csv')
    pokemon_moves_rows = fetch_csv('pokemon_moves.csv')
    version_groups_rows = fetch_csv('version_groups.csv')

    type_id_to_name = {r['id']: r['identifier'] for r in types_rows}
    
    moves_db = {}
    for r in moves_rows:
        m_id = int(r['id'])
        raw_name = r['identifier']
        display_name = ' '.join(word.capitalize() for word in raw_name.split('-'))
        moves_db[m_id] = {
            'id': m_id,
            'identifier': raw_name,
            'name': display_name,
            'type': type_id_to_name.get(r['type_id'], 'normal'),
            'power': int(r['power']) if r['power'] else None,
            'accuracy': int(r['accuracy']) if r['accuracy'] else None,
            'pp': int(r['pp']) if r['pp'] else None,
            'priority': int(r['priority']) if r['priority'] else 0,
            'damage_class_id': int(r['damage_class_id']) if r['damage_class_id'] else None,
            'generation_id': int(r['generation_id'])
        }

    with open(os.path.join(SOURCES_DIR, 'moves.json'), 'w', encoding='utf-8') as f:
        json.dump(moves_db, f, indent=2)
    print('Saved moves.json')

    stat_name_map = {
        '1': 'hp',
        '2': 'attack',
        '3': 'defense',
        '4': 'special_attack',
        '5': 'special_defense',
        '6': 'speed'
    }

    pokemon_dict = {}
    for r in pokemon_rows:
        p_id = int(r['id'])
        if p_id > 649 or r['is_default'] != '1':
            continue
        display_name = ' '.join(word.capitalize() for word in r['identifier'].split('-'))
        pokemon_dict[p_id] = {
            'id': p_id,
            'identifier': r['identifier'],
            'name': display_name,
            'height': int(r['height']),
            'weight': int(r['weight']),
            'base_experience': int(r['base_experience']) if r['base_experience'] else None,
            'types': [],
            'stats': {},
            'generation': 1
        }

    for r in species_rows:
        p_id = int(r['id'])
        if p_id in pokemon_dict:
            pokemon_dict[p_id]['generation'] = int(r['generation_id'])
            pokemon_dict[p_id]['capture_rate'] = int(r['capture_rate']) if r['capture_rate'] else None
            pokemon_dict[p_id]['base_happiness'] = int(r['base_happiness']) if r['base_happiness'] else None
            pokemon_dict[p_id]['growth_rate_id'] = int(r['growth_rate_id']) if r['growth_rate_id'] else None
            pokemon_dict[p_id]['gender_rate'] = int(r['gender_rate']) if r['gender_rate'] else None

    for r in pokemon_types_rows:
        p_id = int(r['pokemon_id'])
        if p_id in pokemon_dict:
            t_name = type_id_to_name.get(r['type_id'])
            slot = int(r['slot'])
            if t_name:
                pokemon_dict[p_id]['types'].append((slot, t_name))

    for p_id in pokemon_dict:
        pokemon_dict[p_id]['types'] = [t[1] for t in sorted(pokemon_dict[p_id]['types'], key=lambda x: x[0])]

    for r in pokemon_stats_rows:
        p_id = int(r['pokemon_id'])
        if p_id in pokemon_dict:
            s_name = stat_name_map.get(r['stat_id'])
            if s_name:
                pokemon_dict[p_id]['stats'][s_name] = int(r['base_stat'])

    gen_max_id = {1: 151, 2: 251, 3: 386, 4: 493, 5: 649}

    for gen in range(1, 6):
        max_id = gen_max_id[gen]
        gen_stats = {}
        for p_id in range(1, max_id + 1):
            if p_id not in pokemon_dict:
                continue
            data = json.loads(json.dumps(pokemon_dict[p_id]))
            if gen == 1:
                data['stats']['special'] = data['stats']['special_attack']
                if p_id in (81, 82):
                    data['types'] = ['electric']
            gen_stats[p_id] = data

        with open(os.path.join(SOURCES_DIR, f'gen{gen}', 'base_stats.json'), 'w', encoding='utf-8') as f:
            json.dump(gen_stats, f, indent=2)
        print(f'Saved gen{gen}/base_stats.json ({len(gen_stats)} pokemon)')

    with open(os.path.join(SOURCES_DIR, 'base_stats.json'), 'w', encoding='utf-8') as f:
        json.dump(pokemon_dict, f, indent=2)
    print('Saved base_stats.json')

    print('\nStep 3: Processing Level-up Movesets per Generation...')
    gen_priority_vg = {
        1: [2, 1],
        2: [4, 3],
        3: [6, 7, 5],
        4: [12, 11, 10],
        5: [15, 14]
    }

    raw_moves = {}
    for r in pokemon_moves_rows:
        if r['pokemon_move_method_id'] != '1':
            continue
        p_id = int(r['pokemon_id'])
        if p_id > 649:
            continue
        vg_id = int(r['version_group_id'])
        level = int(r['level'])
        order = int(r['order']) if r['order'] else 0
        move_id = int(r['move_id'])
        
        key = (p_id, vg_id)
        if key not in raw_moves:
            raw_moves[key] = []
        raw_moves[key].append((level, order, move_id))

    master_movesets = {}

    for gen in range(1, 6):
        max_id = gen_max_id[gen]
        vg_list = gen_priority_vg[gen]
        gen_movesets = {}

        for p_id in range(1, max_id + 1):
            chosen_moves = None
            for vg_id in vg_list:
                if (p_id, vg_id) in raw_moves:
                    chosen_moves = raw_moves[(p_id, vg_id)]
                    break
            
            if chosen_moves:
                chosen_moves.sort(key=lambda x: (x[0], x[1]))
                move_list = []
                seen_levels_moves = set()
                for lvl, ord_num, m_id in chosen_moves:
                    if (lvl, m_id) in seen_levels_moves:
                        continue
                    seen_levels_moves.add((lvl, m_id))
                    m_info = moves_db.get(m_id, {})
                    move_list.append({
                        'level': lvl,
                        'move_id': m_id,
                        'identifier': m_info.get('identifier', f'move_{m_id}'),
                        'name': m_info.get('name', f'Move {m_id}'),
                        'type': m_info.get('type', 'normal'),
                        'power': m_info.get('power'),
                        'accuracy': m_info.get('accuracy'),
                        'pp': m_info.get('pp')
                    })
                gen_movesets[p_id] = move_list

        with open(os.path.join(SOURCES_DIR, f'gen{gen}', 'movesets.json'), 'w', encoding='utf-8') as f:
            json.dump(gen_movesets, f, indent=2)
        print(f'Saved gen{gen}/movesets.json ({len(gen_movesets)} pokemon movesets)')

        master_movesets[f'gen{gen}'] = gen_movesets

    with open(os.path.join(SOURCES_DIR, 'movesets.json'), 'w', encoding='utf-8') as f:
        json.dump(master_movesets, f, indent=2)
    print('Saved consolidated movesets.json')

    print('\nAll tasks completed successfully!')

if __name__ == '__main__':
    main()
