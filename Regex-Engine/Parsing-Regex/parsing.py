import re

# One or more digits
pattern =r"\d+"

text = "I have 40 eggs and 20 breads"

matches = re.findall(pattern, text)

print(matches) # output is : 40 and 20