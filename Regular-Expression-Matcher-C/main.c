#include <stdio.h>
#include <string.h>

/* match: search for regexp anywhere in text */
int match(char *regexp, char *text) {
    if (regexp[0] == '^')
        return matchhere(regexp + 1, text);
    do {   /* must look even if string is empty */
        if (matchhere(regexp, text))
            return 1;
    } while (*text++ != '\0');
    return 0;
}

/* matchhere: search for regexp at beginning of text */
int matchhere(char *regexp, char *text) {
    if (regexp[0] == '\0')
        return 1;                          /* empty pattern matches */

    if (regexp[1] == '*')
        return matchstar(regexp[0], regexp + 2, text);

    if (regexp[0] == '$' && regexp[1] == '\0')
        return *text == '\0';              /* $ matches end of text */

    if (*text != '\0' && (regexp[0] == '.' || regexp[0] == *text))
        return matchhere(regexp + 1, text + 1);

    return 0;
}

/* matchstar: match c* followed by rest at text */
int matchstar(int c, char *regexp, char *text) {
    do {  /* a * matches zero or more instances */
        if (matchhere(regexp, text))
            return 1;
    } while (*text != '\0' && (*text++ == c || c == '.'));
    return 0;
}

int main(void) {
    printf("%d\n", match("abc",   "xxabcyy"));   // 1 (found)
    printf("%d\n", match("^abc",  "xxabcyy"));   // 0 (not at start)
    printf("%d\n", match("a.c",   "axc"));       // 1
    printf("%d\n", match("ab*c",  "ac"));        // 1 (zero b's)
    printf("%d\n", match("ab*c",  "abbbbc"));    // 1
    printf("%d\n", match("abc$",  "xxabc"));     // 1
    printf("%d\n", match("a*b",   "aaab"));      // 1
    return 0;
}