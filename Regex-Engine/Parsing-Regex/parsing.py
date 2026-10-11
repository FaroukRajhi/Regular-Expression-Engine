# testing an empty string with re_parse function that return none
# It takes ('') as input

assert re_parse('') is none

# Wildcard matches any character
assert re_parse('.') == 'dot'

# literal character (returnd as-is)
assert re_parse('a') == 'a'

# Concatenation of a then b
assert re_parse('ab') == ('cat', 'a', 'b')

# Alternation (branch) => match a or b 
assert re_parse('a|b') == ('split', 'a', 'b')

# a repeated to infinite times 
assert re_parse('a+') == ('repeat', 'a', 1, float('inf'))

# a repeated 1 to infinte times
assert re_parse('a{3,6}') == ('repeat', 'a', 3, 6)

# match a or concatenatenation bc
assert re_parse('a|bc') == ('split', 'a', ('cat', 'b', 'c'))


# r: the regex string
# index: the current parsing position
