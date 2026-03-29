import os

files = [
    r'c:\others\shin beginning\new_part\glysmork\frontend\src\app\dashboard\page.tsx',
    r'c:\others\shin beginning\new_part\glysmork\frontend\src\components\Header.tsx',
    r'c:\others\shin beginning\new_part\glysmork\frontend\src\app\chat\room\page.tsx',
    r'c:\others\shin beginning\new_part\glysmork\frontend\src\app\layout.tsx',
]

# Text/copy changes: romantic → networking
text_replacements = [
    # Remove hearts everywhere
    (' ♥', ''),
    ('♥ ', ''),
    (' ♥\n', '\n'),
    ('♥\n', '\n'),
    ("♥", ''),
    # Remove inline heart suffix
    ('Match ♥', 'Match'),
    ('matching. ♥', 'matching.'),
    ('💬', ''),
    # Remove cursive font override on hero
    ("style={{ fontFamily: 'var(--font-dancing)' }}", ''),
    # Update hero copy
    ('Find Your\n                        Perfect Match', 'Find The\n                        Right Person'),
    ('Find Your<br />Perfect Match', 'Find The<br />Right Person'),
    # Update welcome line
    ('is here.<br/>Describe your intent and our AI finds the right person for you.', 
     'is online.<br/>Describe your intent — AI finds the right person for you.'),
    # Remove the heart class from background decorations (the entire block)
    # Update profile card
    ('Identity synced. Ready for profile-based blind matching.', 
     'Profile synced. Ready for AI-powered matching.'),
    # Update notification copy
    ('wants to chat with you!', 'wants to connect with you'),
    # Placeholder
    ('Someone who loves deep conversations...', 
     'e.g. Backend dev who knows Python and system design...'),
    # Subtitle
    ('05. Persona Match', '02. Persona Match'),
    # Background color to pure white
    ("backgroundColor: '#F0F8FF'", "backgroundColor: '#FFFFFF'"),
    ('bg-[#F0F8FF]', 'bg-white'),
    # Match card text
    ('Your Matches', 'Search Results'),
    ('AI found people for:', 'AI matched candidates for:'),
    # "02. Status cards" networking copy
    ('find your ideal connection.', 'find your ideal collaborator or match.'),
]

for fpath in files:
    if not os.path.exists(fpath):
        print(f'SKIP: {fpath}')
        continue
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    for old, new in text_replacements:
        content = content.replace(old, new)
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'OK: {fpath}')

print('Done.')
