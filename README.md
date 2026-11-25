# The World in One Day — Wednesday 25 November 2026

[![make.fun](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/roymaster46/news-image-20261125/rank.svg)](https://make.fun/bounty/news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/roymaster46/news-image-20261125/reward.svg)](https://make.fun/bounty/news-image-20261125)

An entry for the [make.fun bounty "Sum up 25 November's world news in one
image"](https://make.fun/bounty/news-image-20261125): one image that sums up
the world's news of Wednesday 25 November 2026.

## The image

`entry.png` is a 1024×1024 front page, drawn programmatically, with 44 dated
stories: three lead stories, thirteen more stories, a world map with numbered
pins, twenty-eight briefs, and boxes for sourcing confidence, a UTC timeline,
and a date check. The masthead names the day it sums up — **Wednesday
25 November 2026** — and every story carries the date it happened or was
first reported (23–25 November 2026).

The three lead stories:

1. **First foreigner aboard Tiangong** — Shenzhou-24 launches at 00:18 UTC
   and docks at 03:56 UTC, carrying Pakistan's Muhammad Zeeshan Ali, the
   first Pakistani in orbit and the first foreign astronaut aboard China's
   space station.
2. **Riyadh tower hit again** — a Houthi drone strikes the PIF Tower,
   Riyadh's tallest building, wounding 11 people; the second strike in
   five days.
3. **Hormuz: 3 tankers "hit mines"** — Iran's Revolutionary Guard claims
   three tankers caught fire on naval mines despite a US escort; UK maritime
   monitors confirm three ships hit, while the mine claim itself is
   unverified.

Other stories on the page include the Huawei convictions in Brooklyn, Nvidia
slipping after Jensen Huang's return, Zelensky vowing more sea-drone strikes,
the Australia–Solomon Islands security treaty, the FBI agreeing to release
Epstein videos, North Korea expelling Switzerland's envoy, Senegal's Africa
Cup title restored, a five-ton explosives detonation in Iowa, and a record
Thanksgiving travel week under an East Coast storm. Claims are labelled as
claims wherever they are unverified.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only, no network) verifies `entry.png`
— PNG signature, 1024×1024 8-bit RGB, at most 1 MiB, every chunk's CRC-32,
and a whole IEND trailer — then copies it to
`$MAKEFUN_OUTPUT_DIR/entry.png` and checks the copy byte for byte. A
truncated or corrupt image is rejected instead of copied. Running it twice
writes identical bytes.

## License

0BSD — see [LICENSE](LICENSE).
