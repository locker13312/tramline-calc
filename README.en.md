# Koliia: tramline calculator for seeding

A web calculator for farmers. It works out **which seed drill coulters to shut off and on which pass**,
so the field gets unseeded tracks for the wheels of every machine that will drive on it later: sprayer,
spreader, combine and grain cart. Ukrainian version: [README.md](README.md).

Live: **https://tramline-calc.onrender.com**

## The problem

Tramlines are cut once, during seeding, but many machines use them. The right answer depends on the
working width of each machine, its wheel track, tyre width, row spacing and coulter layout. A mistake of
one coulter repeats across the whole field on every cycle, and paper reference tables only cover one
machine at a time.

The calculator takes the farm's real fleet, any number of machines with any widths and tracks, and finds
the union of their wheel strips. It also:

- picks the tramline step that fits the most machines, not simply the narrowest one
- searches for the best starting offset, which alone can change the result from 8 to 30 coulters
- shows how many coulters are lost **because of each machine**, so a mismatched wheel track is obvious

## Stack

React 18 and Vite on the front end, Express and PostgreSQL on the back end, JWT accounts for saved
fields and machinery. The calculator itself works without an account.

## Quality checks

| Command                 | What it checks                                                       |
| ----------------------- | -------------------------------------------------------------------- |
| `npm test`              | calculation logic, with Node's built-in test runner                  |
| `npm run test:render`   | every screen renders without errors or `NaN`                         |
| `npm run test:contrast` | text contrast in light and dark themes against WCAG                  |
| `npm run test:css`      | every class used in the markup has a style                           |
| `npm run test:speed`    | response time for each input change and for the search of options    |
| `npm run test:server`   | accounts: registration, login, users cannot see each other's data     |

## Run locally

Requires Node.js 18+ and PostgreSQL.

```bash
npm install
cp .env.example .env    # DATABASE_URL and JWT_SECRET
npm run build
npm start               # http://localhost:3002, API and page together
```

`npm run dev` starts Vite on port 5180 for front-end work.
