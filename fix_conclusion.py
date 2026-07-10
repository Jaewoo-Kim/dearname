# -*- coding: utf-8 -*-
import sys
import io

# Read the file
with open('C:/dearname/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File loaded: {len(content)} chars")

# Strategy: find each conclusionLetter line start and end, extract the value,
# replace actual newlines with \n, put back

changes = 0

# Find all positions where: conclusionLetter: '...감사합니다.',
# We'll find by known start markers and known end markers

# For each demo conclusionLetter, we know the start and can find 감사합니다.',
i = 0
while True:
    cl_pos = content.find("conclusionLetter: '", i)
    if cl_pos == -1:
        break

    # Position of the opening quote
    open_quote = cl_pos + len("conclusionLetter: ")  # points to '

    # Look for the end: '감사합니다.',
    # Find '감사합니다.' first
    search_from = open_quote + 1
    # Check if there's a newline in the string (indicating broken JS)
    str_start = open_quote + 1

    # Find closing ',  pattern - look for 감사합니다.',
    end_marker = "감사합니다.',"
    end_pos = content.find(end_marker, search_from)

    if end_pos == -1:
        # Try without hanja ending
        i = cl_pos + 1
        continue

    # Check if there are actual newlines between open_quote and end_pos
    inner_text = content[str_start:end_pos + len("감사합니다.")]

    if '\n' in inner_text:
        # Fix it: replace actual newlines with \n escape
        fixed_inner = inner_text.replace('\n', '\\n')

        # Check we're not making it worse (double escaping)
        if '\\\\n' in fixed_inner:
            print(f"WARNING: double escape at {cl_pos}")
            i = cl_pos + 1
            continue

        old_segment = content[open_quote:end_pos + len("감사합니다.'")]
        new_segment = "'" + fixed_inner + "'"

        content = content[:open_quote] + new_segment + content[end_pos + len("감사합니다.'"):]
        changes += 1
        print(f"Fixed conclusionLetter at position {cl_pos}")
        # Don't advance i since content changed
    else:
        i = cl_pos + 1

print(f"Total changes: {changes}")

if changes > 0:
    with open('C:/dearname/index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("File saved")

# Verify
with open('C:/dearname/index.html', 'r', encoding='utf-8') as f:
    verify = f.read()

# Check for broken conclusionLetters
i = 0
broken = 0
fixed_ok = 0
while True:
    cl_pos = verify.find("conclusionLetter: '", i)
    if cl_pos == -1:
        break

    open_quote = cl_pos + len("conclusionLetter: ")
    str_start = open_quote + 1

    end_marker = "감사합니다.',"
    end_pos = verify.find(end_marker, str_start)

    if end_pos != -1:
        inner = verify[str_start:end_pos + len("감사합니다.")]
        if '\n' in inner:
            broken += 1
            print(f"STILL BROKEN at {cl_pos}")
        else:
            fixed_ok += 1
            print(f"OK at {cl_pos}")

    i = cl_pos + 1

print(f"Verification: {fixed_ok} OK, {broken} broken")
