class DFAParser {
  constructor(pattern) {
    this.pattern = pattern;
    this.pos = 0;
    this.stateCounter = 0;
  }

  // Parse regex pattern into AST
  parse() {
    if (this.pattern.length === 0) {
      return { type: 'empty' };
    }
    const ast = this.parseAlternation();
    if (this.pos < this.pattern.length) {
      throw new Error(`Unexpected character at position ${this.pos}: ${this.pattern[this.pos]}`);
    }
    return ast;
  }

  parseAlternation() {
    let node = this.parseConcatenation();
    while (this.pos < this.pattern.length && this.pattern[this.pos] === '|') {
      this.pos++; // consume '|'
      const right = this.parseConcatenation();
      node = { type: 'alternation', left: node, right };
    }
    return node;
  }

  parseConcatenation() {
    const nodes = [];
    while (this.pos < this.pattern.length && 
           this.pattern[this.pos] !== '|' && 
           this.pattern[this.pos] !== ')') {
      nodes.push(this.parseRepetition());
    }
    if (nodes.length === 0) return { type: 'empty' };
    if (nodes.length === 1) return nodes[0];
    return { type: 'concatenation', nodes };
  }

  parseRepetition() {
    let node = this.parseAtom();
    while (this.pos < this.pattern.length) {
      const ch = this.pattern[this.pos];
      if (ch === '*') {
        this.pos++;
        node = { type: 'star', node };
      } else if (ch === '+') {
        this.pos++;
        node = { type: 'plus', node };
      } else if (ch === '?') {
        this.pos++;
        node = { type: 'optional', node };
      } else {
        break;
      }
    }
    return node;
  }

  parseAtom() {
    const ch = this.pattern[this.pos];
    
    if (ch === '(') {
      this.pos++; // consume '('
      const node = this.parseAlternation();
      if (this.pattern[this.pos] !== ')') {
        throw new Error(`Expected ')' at position ${this.pos}`);
      }
      this.pos++; // consume ')'
      return node;
    } else if (ch === '[') {
      return this.parseCharClass();
    } else if (ch === '.') {
      this.pos++;
      return { type: 'any' };
    } else if (ch === '\\') {
      this.pos++;
      if (this.pos >= this.pattern.length) {
        throw new Error('Trailing backslash');
      }
      const escaped = this.pattern[this.pos];
      this.pos++;
      return { type: 'char', value: escaped };
    } else {
      this.pos++;
      return { type: 'char', value: ch };
    }
  }

  parseCharClass() {
    this.pos++; // consume '['
    let negated = false;
    if (this.pattern[this.pos] === '^') {
      negated = true;
      this.pos++;
    }
    
    const chars = new Set();
    while (this.pos < this.pattern.length && this.pattern[this.pos] !== ']') {
      if (this.pattern[this.pos] === '\\') {
        this.pos++;
        chars.add(this.pattern[this.pos]);
        this.pos++;
      } else if (this.pattern[this.pos + 1] === '-' && this.pattern[this.pos + 2] !== ']') {
        const start = this.pattern[this.pos];
        const end = this.pattern[this.pos + 2];
        for (let c = start.charCodeAt(0); c <= end.charCodeAt(0); c++) {
          chars.add(String.fromCharCode(c));
        }
        this.pos += 3;
      } else {
        chars.add(this.pattern[this.pos]);
        this.pos++;
      }
    }
    this.pos++; // consume ']'
    return { type: 'charClass', chars, negated };
  }
}

class NFABuilder {
  constructor() {
    this.stateCounter = 0;
  }

  newState() {
    return this.stateCounter++;
  }

  // Convert AST to NFA (Thompson's construction)
  buildFromAST(ast) {
    switch (ast.type) {
      case 'empty':
        return this.buildEmpty();
      case 'char':
        return this.buildChar(ast.value);
      case 'any':
        return this.buildAny();
      case 'charClass':
        return this.buildCharClass(ast.chars, ast.negated);
      case 'concatenation':
        return this.buildConcatenation(ast.nodes);
      case 'alternation':
        return this.buildAlternation(ast.left, ast.right);
      case 'star':
        return this.buildStar(ast.node);
      case 'plus':
        return this.buildPlus(ast.node);
      case 'optional':
        return this.buildOptional(ast.node);
      default:
        throw new Error(`Unknown AST node type: ${ast.type}`);
    }
  }

  buildEmpty() {
    const start = this.newState();
    const accept = this.newState();
    return {
      start,
      accept,
      transitions: new Map([[start, [{ epsilon: true, to: accept }]]])
    };
  }

  buildChar(char) {
    const start = this.newState();
    const accept = this.newState();
    return {
      start,
      accept,
      transitions: new Map([[start, [{ char, to: accept }]]])
    };
  }

  buildAny() {
    const start = this.newState();
    const accept = this.newState();
    return {
      start,
      accept,
      transitions: new Map([[start, [{ any: true, to: accept }]]])
    };
  }

  buildCharClass(chars, negated) {
    const start = this.newState();
    const accept = this.newState();
    return {
      start,
      accept,
      transitions: new Map([[start, [{ charClass: { chars, negated }, to: accept }]]])
    };
  }

  buildConcatenation(nodes) {
    if (nodes.length === 0) return this.buildEmpty();
    if (nodes.length === 1) return this.buildFromAST(nodes[0]);
    
    const fragments = nodes.map(node => this.buildFromAST(node));
    const transitions = new Map();
    
    for (let i = 0; i < fragments.length - 1; i++) {
      const current = fragments[i];
      const next = fragments[i + 1];
      
      // Merge transitions
      for (const [state, trans] of current.transitions) {
        if (!transitions.has(state)) transitions.set(state, []);
        transitions.get(state).push(...trans);
      }
      
      // Add epsilon transition from current accept to next start
      if (!transitions.has(current.accept)) transitions.set(current.accept, []);
      transitions.get(current.accept).push({ epsilon: true, to: next.start });
    }
    
    // Add last fragment's transitions
    const last = fragments[fragments.length - 1];
    for (const [state, trans] of last.transitions) {
      if (!transitions.has(state)) transitions.set(state, []);
      transitions.get(state).push(...trans);
    }
    
    return {
      start: fragments[0].start,
      accept: last.accept,
      transitions
    };
  }

  buildAlternation(left, right) {
    const leftNFA = this.buildFromAST(left);
    const rightNFA = this.buildFromAST(right);
    const start = this.newState();
    const accept = this.newState();
    
    const transitions = new Map();
    
    // Copy transitions from both NFAs
    for (const [state, trans] of leftNFA.transitions) {
      transitions.set(state, [...trans]);
    }
    for (const [state, trans] of rightNFA.transitions) {
      if (transitions.has(state)) {
        transitions.get(state).push(...trans);
      } else {
        transitions.set(state, [...trans]);
      }
    }
    
    // Add epsilon transitions from start to both branches
    transitions.set(start, [
      { epsilon: true, to: leftNFA.start },
      { epsilon: true, to: rightNFA.start }
    ]);
    
    // Add epsilon transitions from both accepts to final accept
    if (!transitions.has(leftNFA.accept)) transitions.set(leftNFA.accept, []);
    transitions.get(leftNFA.accept).push({ epsilon: true, to: accept });
    
    if (!transitions.has(rightNFA.accept)) transitions.set(rightNFA.accept, []);
    transitions.get(rightNFA.accept).push({ epsilon: true, to: accept });
    
    return { start, accept, transitions };
  }

  buildStar(node) {
    const inner = this.buildFromAST(node);
    const start = this.newState();
    const accept = this.newState();
    
    const transitions = new Map(inner.transitions);
    
    // Epsilon from start to inner start and accept
    transitions.set(start, [
      { epsilon: true, to: inner.start },
      { epsilon: true, to: accept }
    ]);
    
    // Epsilon from inner accept back to inner start and to accept
    if (!transitions.has(inner.accept)) transitions.set(inner.accept, []);
    transitions.get(inner.accept).push(
      { epsilon: true, to: inner.start },
      { epsilon: true, to: accept }
    );
    
    return { start, accept, transitions };
  }

  buildPlus(node) {
    const inner = this.buildFromAST(node);
    const start = this.newState();
    const accept = this.newState();
    
    const transitions = new Map(inner.transitions);
    
    // Epsilon from start to inner start
    transitions.set(start, [{ epsilon: true, to: inner.start }]);
    
    // Epsilon from inner accept back to inner start and to accept
    if (!transitions.has(inner.accept)) transitions.set(inner.accept, []);
    transitions.get(inner.accept).push(
      { epsilon: true, to: inner.start },
      { epsilon: true, to: accept }
    );
    
    return { start, accept, transitions };
  }

  buildOptional(node) {
    const inner = this.buildFromAST(node);
    const start = this.newState();
    const accept = this.newState();
    
    const transitions = new Map(inner.transitions);
    
    // Epsilon from start to inner start and directly to accept
    transitions.set(start, [
      { epsilon: true, to: inner.start },
      { epsilon: true, to: accept }
    ]);
    
    // Epsilon from inner accept to accept
    if (!transitions.has(inner.accept)) transitions.set(inner.accept, []);
    transitions.get(inner.accept).push({ epsilon: true, to: accept });
    
    return { start, accept, transitions };
  }
}

class DFABuilder {
  // Convert NFA to DFA using subset construction
  static fromNFA(nfa) {
    const dfaStates = new Map(); // Maps set of NFA states to DFA state ID
    const dfaTransitions = new Map();
    const dfaAccepts = new Set();
    let stateCounter = 0;
    
    // Get epsilon closure of a set of states
    const epsilonClosure = (states) => {
      const closure = new Set(states);
      const stack = [...states];
      
      while (stack.length > 0) {
        const state = stack.pop();
        const transitions = nfa.transitions.get(state) || [];
        
        for (const trans of transitions) {
          if (trans.epsilon && !closure.has(trans.to)) {
            closure.add(trans.to);
            stack.push(trans.to);
          }
        }
      }
      
      return closure;
    };
    
    // Get the start state closure
    const startClosure = epsilonClosure([nfa.start]);
    const startKey = [...startClosure].sort((a, b) => a - b).join(',');
    dfaStates.set(startKey, stateCounter++);
    
    const queue = [startClosure];
    const dfaStart = 0;
    
    while (queue.length > 0) {
      const currentStates = queue.shift();
      const currentKey = [...currentStates].sort((a, b) => a - b).join(',');
      const currentDFAState = dfaStates.get(currentKey);
      
      // Check if this is an accept state
      if (currentStates.has(nfa.accept)) {
        dfaAccepts.add(currentDFAState);
      }
      
      // Collect all transitions from current states
      const transitions = new Map(); // char -> set of next states
      
      for (const state of currentStates) {
        const stateTransitions = nfa.transitions.get(state) || [];
        
        for (const trans of stateTransitions) {
          if (!trans.epsilon) {
            let key;
            if (trans.char) key = `char:${trans.char}`;
            else if (trans.any) key = 'any';
            else if (trans.charClass) key = `class:${JSON.stringify(trans.charClass)}`;
            
            if (!transitions.has(key)) {
              transitions.set(key, { trans, states: new Set() });
            }
            transitions.get(key).states.add(trans.to);
          }
        }
      }
      
      // Create DFA transitions
      if (!dfaTransitions.has(currentDFAState)) {
        dfaTransitions.set(currentDFAState, []);
      }
      
      for (const [key, { trans, states }] of transitions) {
        const nextClosure = epsilonClosure(states);
        const nextKey = [...nextClosure].sort((a, b) => a - b).join(',');
        
        let nextDFAState;
        if (dfaStates.has(nextKey)) {
          nextDFAState = dfaStates.get(nextKey);
        } else {
          nextDFAState = stateCounter++;
          dfaStates.set(nextKey, nextDFAState);
          queue.push(nextClosure);
        }
        
        dfaTransitions.get(currentDFAState).push({
          ...trans,
          to: nextDFAState
        });
      }
    }
    
    return {
      start: dfaStart,
      accepts: dfaAccepts,
      transitions: dfaTransitions,
      numStates: stateCounter
    };
  }
}

class DFAMatcher {
  constructor(pattern) {
    this.pattern = pattern;
    const parser = new DFAParser(pattern);
    const ast = parser.parse();
    const nfaBuilder = new NFABuilder();
    const nfa = nfaBuilder.buildFromAST(ast);
    this.dfa = DFABuilder.fromNFA(nfa);
  }

  // Check if a character matches a transition
  matchesTransition(char, transition) {
    if (transition.char !== undefined) {
      return char === transition.char;
    }
    if (transition.any) {
      return true;
    }
    if (transition.charClass) {
      const { chars, negated } = transition.charClass;
      const inClass = chars.has(char);
      return negated ? !inClass : inClass;
    }
    return false;
  }

  // Find the next state given current state and input character
  nextState(state, char) {
    const transitions = this.dfa.transitions.get(state) || [];
    for (const trans of transitions) {
      if (this.matchesTransition(char, trans)) {
        return trans.to;
      }
    }
    return null; // No valid transition
  }

  // Test if the entire string matches
  test(input) {
    let state = this.dfa.start;
    
    for (const char of input) {
      state = this.nextState(state, char);
      if (state === null) {
        return false;
      }
    }
    
    return this.dfa.accepts.has(state);
  }

  // Find all matches in a string (returns start and end indices)
  findMatches(input) {
    const matches = [];
    
    for (let i = 0; i < input.length; i++) {
      let state = this.dfa.start;
      let lastAccept = null;
      
      if (this.dfa.accepts.has(state)) {
        lastAccept = i;
      }
      
      for (let j = i; j < input.length; j++) {
        state = this.nextState(state, input[j]);
        if (state === null) break;
        
        if (this.dfa.accepts.has(state)) {
          lastAccept = j + 1;
        }
      }
      
      if (lastAccept !== null) {
        matches.push({ start: i, end: lastAccept, match: input.slice(i, lastAccept) });
      }
    }
    
    return matches;
  }

  // Replace matches in a string
  replace(input, replacement) {
    const matches = this.findMatches(input);
    if (matches.length === 0) return input;
    
    let result = '';
    let lastEnd = 0;
    
    for (const match of matches) {
      if (match.start >= lastEnd) {
        result += input.slice(lastEnd, match.start);
        result += typeof replacement === 'function' 
          ? replacement(match.match) 
          : replacement;
        lastEnd = match.end;
      }
    }
    
    result += input.slice(lastEnd);
    return result;
  }
}

// Export the main class
class RegexDFA {
  constructor(pattern) {
    this.matcher = new DFAMatcher(pattern);
  }

  test(input) {
    return this.matcher.test(input);
  }

  exec(input) {
    const matches = this.matcher.findMatches(input);
    return matches.length > 0 ? matches[0] : null;
  }

  match(input) {
    return this.matcher.findMatches(input);
  }

  replace(input, replacement) {
    return this.matcher.replace(input, replacement);
  }
}

// Usage examples
const regex1 = new RegexDFA('abc');
console.log(regex1.test('abc')); // true
console.log(regex1.test('abd')); // false

const regex2 = new RegexDFA('a*b');
console.log(regex2.test('b')); // true
console.log(regex2.test('aaab')); // true
console.log(regex2.test('aaac')); // false

const regex3 = new RegexDFA('(a|b)*c');
console.log(regex3.test('c')); // true
console.log(regex3.test('abc')); // true
console.log(regex3.test('aabbc')); // true

const regex4 = new RegexDFA('[0-9]+');
console.log(regex4.test('12345')); // true
console.log(regex4.test('12a45')); // false
console.log(regex4.match('abc 123 def 456')); 
// [{ start: 4, end: 7, match: '123' }, { start: 12, end: 15, match: '456' }]

const regex5 = new RegexDFA('a(b|c)d');
console.log(regex5.test('abd')); // true
console.log(regex5.test('acd')); // true
console.log(regex5.test('aed')); // false