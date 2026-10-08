#include <stdio.h>
#include <string.h>

/* matchhere: search for regexp at beginning of text  back tracking algorithm */
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

/* match: search for regexp anywhere in text*/

int match(char *regexp, char *text)
{
    if(regexp[0] == '^')
    {
        return matchhere(regexp + 1, text);
    }
}