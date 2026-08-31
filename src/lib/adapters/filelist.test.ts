// src/lib/adapters/filelist.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"
import { FilelistAdapter, parseFilelistCredentials, parseFilelistProfile } from "./filelist"
import type { FileListPlatformMeta } from "./types"

const VALID_TOKEN = JSON.stringify({
  cookies: "uid=1683565; pass=abc123def456",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestUA",
})

// ---------------------------------------------------------------------------
// Fixture: verbatim from the owner's userdetails.php?id=1683565 capture
// (2026-08-28, fresh account, English labels). Only redaction: the 32-hex
// Cloudflare beacon token on the final <script> line is zeroed. The saved-page
// asset rewrites ("./Details for ... _files/...") are kept as captured.
// Composed as PAGE_HEAD + HEADER_STRIP + USERDETAILS_ROWS + PAGE_FOOTER.
// ---------------------------------------------------------------------------

const PAGE_HEAD = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<!-- saved from url=(0046)https://filelist.io/userdetails.php?id=1683565 -->
<html xmlns="https://www.w3.org/1999/xhtml"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>Details for BrotherMayIhaveSomeLoops :: FileList</title>

<link rel="stylesheet" href="./Details for BrotherMayIhaveSomeLoops __ FileList_files/blue.css" type="text/css">
<link rel="alternate" type="application/rss+xml" title="Latest Torrents" href="https://filelist.io/rss.php">
<link rel="shortcut icon" href="https://filelist.io/favicon.ico" type="image/x-icon">

<script src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/jquery-2.2.4.min.js.download" integrity="sha256-BbhdlvQf/xTY9gja0Dq3HiwQF8LaCRTXxZKRutelT44=" crossorigin="anonymous"></script>
<script src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/bootstrap.min.js.download"></script>
<link href="./Details for BrotherMayIhaveSomeLoops __ FileList_files/bootstrap.min.css" rel="stylesheet">

</head>

<body>
    <div id="wrapper"><!-- Begin Wrapper -->
    <a name="top"></a>
`

const HEADER_STRIP = `        <div class="mainheader"><!-- Begin Header -->
			<div class="subheader">
                <a href="https://filelist.io/index.php"><div class="logo" style="background-image:url(&#39;/styles/images/logo_18years.png&#39;)"></div></a> <!-- logo -->

	<div class="statusbar">
    <div class="status_avatar" style="float:left;"><a href="https://filelist.io/userdetails.php?id=1683565"><img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/default_thumb.png" alt=""></a></div>

    <div style="float:left;">
         <div style="padding:1px;">
            Hello, <a href="https://filelist.io/userdetails.php?id=1683565"><span style="font-size:11px;font-weight:bold;">BrotherMayIhaveSomeLoops</span></a><span style="position:relative;bottom:2px;"></span> [<font color="#b8b7b7">User</font>]
        </div>
        <div style="padding:1px;">
            <a href="https://filelist.io/messages.php"><span>0</span><span style="position: relative;bottom: 3px;"> <img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/messages.gif" alt="No New Messages" title="No New Messages"></span></a>&nbsp;&nbsp;
            <a href="https://filelist.io/reputation.php"><span style="position: relative;bottom: 1px;"><img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/reputation.png" alt="Reputation" title="Reputation"></span></a>&nbsp;&nbsp;
            <a href="https://filelist.io/friends.php"><span style="position: relative;bottom: 1px;"><img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/buddylist.gif" alt="Friends" title="Friends"></span></a>&nbsp;&nbsp;
            <a href="https://filelist.io/irc.php"><img style="border: none" alt="iRC" title="iRC" src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/mirc.png" width="14" height="14"></a>&nbsp;&nbsp;
            <a href="https://filelist.io/getrss.php"><img style="border:none" alt="Rss" title="Rss" src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/rss.png"></a>&nbsp;&nbsp;
            <a href="https://filelist.io/hof.php"><img style="border: none" alt="Hall of Fame" title="Hall of Fame" src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/cup.png" width="14" height="14"></a>&nbsp;&nbsp;
            <a href="https://filelist.io/bookmarks.php"><img style="border: none" alt="Bookmarks" title="Bookmarks" src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/bookmark.png" width="14" height="14"></a>&nbsp;&nbsp;



        </div>

        <div style="padding:1px;font-weight:bold;">
            <span style="margin-right:5px;"><a href="https://filelist.io/shop.php"> <img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/flcoins.png" height="14" style="position:relative;bottom:1px;"> 0.0</a></span>
            <span style="margin-right:5px;"><a href="https://filelist.io/invite.php"><img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/invite.png" height="14" style="position:relative;bottom:1px;"> Invites 0</a></span>
            <span style="margin-right:5px;"><a href="https://filelist.io/my.php"><img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/user.png" width="12" height="14" style="position:relative;bottom:1px;"> Profile</a></span>
            <span style="margin-right:5px;"><a href="https://filelist.io/logout.php?id=1683565"><img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/logout.png" width="12" height="12" style="position:relative;bottom:1px;"> Logout</a></span>
        </div>

        <div style="padding:1px;">
            <span style="margin-right:5px;"><img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/ratio.png" height="12" style="position:relative;bottom:1px;"> <font color="#2471ff">Ratio</font>&nbsp;---</span>
            <span style="margin-right:5px;"><img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/download_token.png" height="12" style="position:relative;bottom:1px;"> <a href="https://filelist.io/snatchlist.php?id=1683565&amp;action=tokens"><font color="#2471ff">Tokens</font>&nbsp;0</a></span>
            <span style="margin-right:5px;"><img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/snatchlist.png" height="12" style="position:relative;bottom:1px;"><a href="https://filelist.io/snatchlist.php?id=1683565">&nbsp;SnatchList</a></span>
        </div>

        <div style="padding:1px;">
            <span style="margin-right:5px;"><img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/uploaded.png" width="10" height="12" style="position:relative;bottom:1px;"> <font color="#34a60c">Uploaded</font>:&nbsp;0.00 kB</span>
            <span style="margin-right:5px;"><img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/downloaded.png" width="10" height="12" style="position:relative;bottom:1px;"> <font color="#d21919">Downloaded</font>:&nbsp;0.00 kB</span>
        </div>
    </div>
    <div class="clearfix"></div></div><div id="navigation"><!-- Begin Navigation -->
	<div id="nav">
    <ul><!--[if IE]><li class='fleft'><a href='/index.php'>Home</a></li><![endif]--><!--[if !IE]><!--><li class="fleft"><a href="https://filelist.io/index.php">Home</a></li><!--<![endif]--><li class="fleft"><a href="https://filelist.io/browse.php">Browse</a></li><li class="fleft"><a href="https://filelist.io/internal.php">Internal</a></li><li class="fleft"><a href="https://filelist.io/donate.php">Donate</a></li><li class="fleft"><a href="https://filelist.io/upload.php">Upload</a></li><li class="fleft"><a href="https://filelist.io/viewrequests.php">Requests</a></li><li class="fleft"><a href="https://filelist.io/forums.php">Forums</a></li><li class="fleft"><a href="https://filelist.io/support.php">Support</a></li><li class="fleft"><a href="https://filelist.io/faq.php">FAQ</a></li><li class="fleft"><a href="https://filelist.io/rules.php">Rules</a></li></ul>
                </div>
                </div> <!-- End Navigation -->
            </div><!-- End SubHeader -->
        </div><!-- End Header -->

        <div class="clear"></div>
        `

const INVITATIONS_ROW = `<tr><td class="colhead">Invitations</td><td>
Active invites: <b>0</b><br>Confirmed: </td></tr>`

const USERDETAILS_ROWS = `
        <div id="container"><!-- Start Container -->
            <div id="maincolumn"><!-- Start Maincolumn --><div class="cblock">
    <div class="cblock-top"></div>
	<div class="clearfix"></div>
    <div class="cblock-content">
	<div class="cblock-innercontent"><div align="center" style="margin-bottom:3px;"><h1 style="margin:0px">BrotherMayIhaveSomeLoops<span style="position:relative;bottom:2px;"><img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/usa.png" alt="United States of America" style="margin-left: 8pt"></span></h1></div><div align="center"></div><br><table width="90%" cellspacing="0" cellpadding="5">
<tbody><tr><td class="colhead" width="20%">Join&nbsp;date</td><td style="text-align:left;">2026-08-20 19:05:17 (1 week ago)</td></tr>

<tr><td class="colhead">Last&nbsp;seen</td><td style="text-align:left;">2026-08-28 18:49:52 (&lt; 1 min ago)</td></tr><tr><td class="colhead">Invited by</td><td style="text-align:left;"><a href="https://filelist.io/userdetails.php?id=1538531">1538531</a></td></tr>
${INVITATIONS_ROW}
<tr><td class="colhead">Uploaded</td><td style="text-align:left;">0.00 kB</td></tr>
<tr><td class="colhead">Downloaded</td><td style="text-align:left;">0.00 kB</td></tr>
<tr><td class="colhead">Reputation</td><td><div style="float:left;position:relative;top:5px;"><div title="10 Rep. Points" style="background-image: url(/styles/images/reputation/bg.png);width:150px;height:25px;margin-bottom:10px;">
		<div style="max-width:10px;overflow:hidden;"><img src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/green.png" width="150px" height="25px"></div>
	</div></div></td></tr><tr><td class="colhead">Class</td><td style="text-align:left;"><font color="#b8b7b7">User</font></td></tr>
<tr><td class="colhead">Torrent&nbsp;comments</td><td style="text-align:left;">0</td></tr>
<tr><td class="colhead">Forum&nbsp;posts</td><td style="text-align:left;">0</td></tr>
<tr valign="top"><td class="colhead">Seed bonus</td><td><div style="padding:3px;">Seeding <b>0</b> torrents with a total seed size of <b>0.00 GB</b>.</div></td></tr></tbody></table>
</div></div>
	<div class="cblock-bottom"></div>
	</div>
            </div><!-- End Maincolumn -->
            <div class="clear"></div>
        </div><!-- End Container -->
`

const PAGE_FOOTER = `
        <!-- Begin Footer -->
        <div id="footer">
			<div id="footerInner">
			<div class="boxFooter">
				<h2>&nbsp;&nbsp;Quick Navigation</h2>
				<ul><span style="position: relative;bottom: 8px;"><a href="https://filelist.io/index.php" title="Home">Home</a></span></ul>
				<ul><span style="position: relative;bottom: 8px;"><a href="https://filelist.io/browse.php" title="Browse">Browse</a></span></ul>
				<ul><span style="position: relative;bottom: 8px;"><a href="https://filelist.io/forums.php" title="Forums">Forums</a></span></ul>
				<ul><span style="position: relative;bottom: 8px;"><a href="https://filelist.io/my.php" title="Profile">Profile</a></span></ul>
				<ul><span style="position: relative;bottom: 8px;"><a href="https://filelist.io/donate.php" title="Donate">Donate</a></span></ul>
			</div>

			<div class="boxFooter">
				<h2>&nbsp;&nbsp;Help &amp; Support</h2>
				<ul><span style="position: relative;bottom: 8px;"><a href="https://filelist.io/support.php" title="Support">Support</a></span></ul>
				<ul><span style="position: relative;bottom: 8px;"><a href="https://filelist.io/forums.php?action=viewtopic&amp;topicid=91646" title="Ghid">Ghidul trackerului</a></span></ul>
				<ul><span style="position: relative;bottom: 8px;"><a href="https://filelist.io/irc.php" title="iRC">iRC Support</a></span></ul>
				<ul><span style="position: relative;bottom: 8px;"><a href="https://filelist.io/rules.php" title="Rules">Rules</a></span></ul>
				<ul><span style="position: relative;bottom: 8px;"><a href="https://filelist.io/faq.php" title="FAQ">FAQ</a></span></ul>
			</div>

			<div class="boxFooter">
				<h2>&nbsp;&nbsp;Links</h2>
				<ul><span style="position: relative;bottom: 8px;"><a href="https://filelist.io/whitelist.php" title="Client Whitelist">Client Whitelist</a></span></ul>
		        <ul><span style="position: relative;bottom: 8px;"><a href="https://filelist.io/report.php" title="Termeni de utilizare">Termeni de utilizare</a></span></ul>
		        <!-- <ul><span style='position: relative;bottom: 8px;'><a href='/useragreement.php' title='User Agreement'>User Agreement</a></span></ul> -->
	        </div>

	        <div class="boxFooter">
	            <h2>&nbsp;&nbsp;Social</h2>
				<ul><span style="position: relative;bottom: 8px;"><a href="https://filelist.io/hof.php" title="HoF">Hall of Fame</a></span></ul>
	            <ul><span style="position: relative;bottom: 8px;"><a href="https://www.facebook.com/filelist" title="FL Facebook">FileList Facebook</a></span></ul>
	            <ul><span style="position: relative;bottom: 8px;"><a href="https://www.youtube.com/user/GameOnFL" title="FL YouTube">FileList YouTube</a></span></ul>
	        </div>
			</div>
        </div>
        <!-- End Footer -->

		<div id="copyright"><!-- COPYRIGHT -->
		<div id="copyrightInner">
			<font class="small"><b>Powered by <a href="https://www.filelist.io/">FileList</a> since 2007. No rights reserved!</b></font><br>
			<font class="small"><b>Running <a href="https://github.com/WhatCD/Ocelot" target="_blank">Ocelot</a> v2.0 - heavily modified version</b></font>

			<div id="copyrightInnerRight"><b>
				<font class="small"><a href="https://filelist.io/support.php" title="Contact">Contact</a></font>
				&nbsp; | &nbsp;
				<font class="small"><a href="https://filelist.io/userdetails.php?id=1683565#top" class="gototop" title="Go To Top">To Top</a></font>
			</b></div>
		</div>
		</div><!-- END COPYRIGHT -->
		</div><!-- End Wrapper -->

		<script type="text/javascript">
		/* <![CDATA[ */
		$(document).ready(function() {
			$('.gototop').click(function(){
				$('html, body').animate({scrollTop:0}, 'slow');
				return false;
			});
		});
		</script>

	<script type="module" src="./Details for BrotherMayIhaveSomeLoops __ FileList_files/v3d52b47920f24c319d37e2661827c42b1787588026925" integrity="sha512-d9sL6GJLXn6fInD1+TVXhTcQOsmxeHfmHAvwGDIxp5TO+uo1fiWW7mHomMj4MLRlCsJDTqXzWLHJFFlPCEIj/A==" data-cf-beacon="{&quot;version&quot;:&quot;2024.11.0&quot;,&quot;token&quot;:&quot;00000000000000000000000000000000&quot;,&quot;r&quot;:1}" crossorigin="anonymous"></script>

	</body></html>`

const FULL_PAGE = PAGE_HEAD + HEADER_STRIP + USERDETAILS_ROWS + PAGE_FOOTER

/**
 * Replaces exactly one occurrence, throwing when the needle is missing or
 * ambiguous, so a fixture edit can never silently no-op or hit the wrong spot.
 */
function editFixture(html: string, needle: string, replacement: string): string {
  const first = html.indexOf(needle)
  if (first === -1) throw new Error(`fixture needle not found: ${needle}`)
  if (html.lastIndexOf(needle) !== first) throw new Error(`fixture needle ambiguous: ${needle}`)
  return html.replace(needle, replacement)
}

// synthetic-fixture: the real capture with figures (never structure) edited to
// a populated account. Formatting the fresh page never shows (pluralization,
// comma grouping, relative-time wording) is unverified until Task 8's
// validate-as-the-account-accrues pass.
const POPULATED_PAGE = [
  [
    `<td class="colhead">Uploaded</td><td style="text-align:left;">0.00 kB</td>`,
    `<td class="colhead">Uploaded</td><td style="text-align:left;">12.53 TB</td>`,
  ],
  [
    `<td class="colhead">Downloaded</td><td style="text-align:left;">0.00 kB</td>`,
    `<td class="colhead">Downloaded</td><td style="text-align:left;">3.67 TB</td>`,
  ],
  // Header ratio deliberately the site's 2-decimal rounding of 12.53/3.67, so
  // the derived-ratio test can prove the header text is not what is returned.
  [`Ratio</font>&nbsp;---`, `Ratio</font>&nbsp;3.41`],
  [
    `Seeding <b>0</b> torrents with a total seed size of <b>0.00 GB</b>.`,
    `Seeding <b>42</b> torrents with a total seed size of <b>18.20 TB</b>.`,
  ],
  [`> 0.0</a>`, `> 1543.8</a>`],
  [`Tokens</font>&nbsp;0</a>`, `Tokens</font>&nbsp;3</a>`],
  [`> Invites 0</a>`, `> Invites 2</a>`],
  [`Active invites: <b>0</b>`, `Active invites: <b>2</b>`],
  [`title="10 Rep. Points"`, `title="512 Rep. Points"`],
].reduce((html, [needle, replacement]) => editFixture(html, needle, replacement), FULL_PAGE)

// synthetic-fixture: figures-only edit exercising the site's lowercase "kB"
// unit on a non-zero value, which doubles as the zero-download Infinity case.
const INFINITY_PAGE = editFixture(
  FULL_PAGE,
  `<td class="colhead">Uploaded</td><td style="text-align:left;">0.00 kB</td>`,
  `<td class="colhead">Uploaded</td><td style="text-align:left;">123.45 kB</td>`
)

// synthetic-fixture: figures-only edit producing a deficit account.
const DEFICIT_PAGE = editFixture(
  editFixture(
    FULL_PAGE,
    `<td class="colhead">Uploaded</td><td style="text-align:left;">0.00 kB</td>`,
    `<td class="colhead">Uploaded</td><td style="text-align:left;">500.00 GB</td>`
  ),
  `<td class="colhead">Downloaded</td><td style="text-align:left;">0.00 kB</td>`,
  `<td class="colhead">Downloaded</td><td style="text-align:left;">1.20 TB</td>`
)

// synthetic-fixture: Invitations row removed (a structure edit, flagged as
// such) to reach the header "Invites N" fallback.
const NO_INVITATIONS_ROW_PAGE = editFixture(FULL_PAGE, INVITATIONS_ROW, "")

// synthetic-fixture: no logged-out capture exists; minimal login-page shape
// (takelogin.php form, no logout.php link anywhere in the body).
const LOGIN_PAGE = `<!DOCTYPE html><html><head><title>FileList</title></head><body>
<form action="takelogin.php" method="post">
<input type="text" name="username"><input type="password" name="password">
<input type="submit" value="Login">
</form></body></html>`

// Header strip present (so the logout.php marker passes) but no profile table.
const HEADER_ONLY_PAGE = PAGE_HEAD + HEADER_STRIP + PAGE_FOOTER

describe("parseFilelistProfile", () => {
  it("extracts core stats from the fresh-account capture", () => {
    const stats = parseFilelistProfile(FULL_PAGE)
    expect(stats.username).toBe("BrotherMayIhaveSomeLoops")
    expect(stats.group).toBe("User")
    expect(stats.uploadedBytes).toBe(0n)
    expect(stats.downloadedBytes).toBe(0n)
    expect(stats.seedbonus).toBe(0)
    expect(stats.seedingCount).toBe(0)
    expect(stats.freeleechTokens).toBe(0)
    expect(stats.joinedDate).toBe("2026-08-20")
    expect(stats.lastAccessDate).toBe("2026-08-28")
    // Task 6's fetch layer owns remoteUserId, the parser never sets it
    expect(stats.remoteUserId).toBeUndefined()
  })

  it("returns ratio 0 and a zero buffer when both totals are zero", () => {
    const stats = parseFilelistProfile(FULL_PAGE)
    expect(stats.ratio).toBe(0)
    expect(stats.bufferBytes).toBe(0n)
  })

  it("derives ratio from byte totals even when the header strip disagrees", () => {
    const stats = parseFilelistProfile(POPULATED_PAGE)
    expect(stats.uploadedBytes).toBe(12_530_000_000_000n) // synthetic-fixture
    expect(stats.downloadedBytes).toBe(3_670_000_000_000n) // synthetic-fixture
    // The header strip says 3.41; the derived value keeps full precision.
    expect(stats.ratio).toBeCloseTo(12.53 / 3.67, 4) // synthetic-fixture
    expect(stats.ratio).not.toBe(3.41) // synthetic-fixture
    expect(stats.bufferBytes).toBe(8_860_000_000_000n) // synthetic-fixture
  })

  it("parses the site's lowercase kB unit and returns Infinity on zero download", () => {
    const stats = parseFilelistProfile(INFINITY_PAGE)
    expect(stats.uploadedBytes).toBe(123_450n) // synthetic-fixture
    expect(stats.downloadedBytes).toBe(0n) // synthetic-fixture
    expect(stats.ratio).toBe(Infinity) // synthetic-fixture
  })

  it("preserves a negative buffer unclamped", () => {
    const stats = parseFilelistProfile(DEFICIT_PAGE)
    expect(stats.uploadedBytes).toBe(500_000_000_000n) // synthetic-fixture
    expect(stats.downloadedBytes).toBe(1_200_000_000_000n) // synthetic-fixture
    expect(stats.bufferBytes).toBe(-700_000_000_000n) // synthetic-fixture
  })

  it("returns null for every field FileList does not show", () => {
    const stats = parseFilelistProfile(FULL_PAGE)
    expect(stats.leechingCount).toBeNull()
    expect(stats.hitAndRuns).toBeNull()
    expect(stats.requiredRatio).toBeNull()
    expect(stats.warned).toBeNull()
  })

  it("extracts platformMeta from the fresh-account capture", () => {
    const stats = parseFilelistProfile(FULL_PAGE)
    const meta = stats.platformMeta as FileListPlatformMeta
    expect(meta.invites).toBe(0)
    expect(meta.reputation).toBe(10)
    expect(meta.totalSeedSizeBytes).toBe(0)
  })

  it("extracts platformMeta and seeding figures from a populated page", () => {
    const stats = parseFilelistProfile(POPULATED_PAGE)
    const meta = stats.platformMeta as FileListPlatformMeta
    expect(stats.seedingCount).toBe(42) // synthetic-fixture
    expect(stats.seedbonus).toBeCloseTo(1543.8) // synthetic-fixture
    expect(stats.freeleechTokens).toBe(3) // synthetic-fixture
    expect(meta.invites).toBe(2) // synthetic-fixture
    expect(meta.reputation).toBe(512) // synthetic-fixture
    expect(meta.totalSeedSizeBytes).toBe(18_200_000_000_000) // synthetic-fixture
  })

  it("falls back to the header Invites count when the Invitations row is missing", () => {
    const stats = parseFilelistProfile(NO_INVITATIONS_ROW_PAGE)
    const meta = stats.platformMeta as FileListPlatformMeta
    expect(meta.invites).toBe(0) // synthetic-fixture
  })

  it("throws session-expired on a 200 login page", () => {
    // synthetic-fixture
    expect(() => parseFilelistProfile(LOGIN_PAGE)).toThrow(
      "Session expired. Browser cookies need to be refreshed"
    )
  })

  it("throws on Cloudflare challenge markers", () => {
    const markers = [
      `<!doctype html><html><head><title>Just a moment...</title></head><body></body></html>`,
      `<!doctype html><html><body><script>window._cf_chl_opt = {}</script></body></html>`,
      `<!doctype html><html><body><script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script></body></html>`,
    ]
    for (const page of markers) {
      expect(() => parseFilelistProfile(page)).toThrow(
        "Cloudflare challenge detected. Cookies need refreshing"
      )
    }
  })

  it("throws when neither byte total is present", () => {
    expect(() => parseFilelistProfile(HEADER_ONLY_PAGE)).toThrow(
      "Could not find profile stats on FileList page. The page may not be authenticated"
    )
  })
})

describe("parseFilelistCredentials", () => {
  it("parses a valid credential blob", () => {
    const creds = parseFilelistCredentials(VALID_TOKEN)
    expect(creds.cookies).toBe("uid=1683565; pass=abc123def456")
    expect(creds.userAgent).toBe("Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestUA")
  })

  it("strips a pasted 'Cookie: ' prefix", () => {
    const creds = parseFilelistCredentials(
      JSON.stringify({ cookies: "Cookie: uid=1; pass=x", userAgent: "UA" })
    )
    expect(creds.cookies).toBe("uid=1; pass=x")
  })

  it("rejects non-JSON", () => {
    expect(() => parseFilelistCredentials("not json")).toThrow(
      "FileList credentials must be a JSON object with cookies and userAgent"
    )
  })

  it("rejects a missing field", () => {
    expect(() => parseFilelistCredentials(JSON.stringify({ cookies: "uid=1; pass=x" }))).toThrow(
      "FileList credentials must contain cookies (string) and userAgent (string)"
    )
  })

  it("rejects an empty field", () => {
    expect(() =>
      parseFilelistCredentials(JSON.stringify({ cookies: "  ", userAgent: "UA" }))
    ).toThrow("FileList credentials: cookies cannot be empty")
  })

  it("rejects a lone cookie name paste", () => {
    expect(() =>
      parseFilelistCredentials(JSON.stringify({ cookies: "pass", userAgent: "UA" }))
    ).toThrow(/pasted a cookie name/)
  })

  it("rejects a value with no key=value pairs", () => {
    expect(() =>
      parseFilelistCredentials(JSON.stringify({ cookies: "abcdef", userAgent: "UA" }))
    ).toThrow(/key=value pairs/)
  })

  it("rejects non-ASCII truncation artifacts", () => {
    expect(() =>
      parseFilelistCredentials(JSON.stringify({ cookies: "uid=1; pass=abc…", userAgent: "UA" }))
    ).toThrow(/non-ASCII character/)
  })
})

// ---------------------------------------------------------------------------
// Adapter: fetch wiring, user-id resolution, redirects, errors, fetchRaw
// ---------------------------------------------------------------------------

// Cookies without a uid pair, forcing the homepage bootstrap path.
const NO_UID_TOKEN = JSON.stringify({
  cookies: "pass=abc123def456; flsession=xyz",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestUA",
})

function okPage(html: string): Response {
  return { ok: true, status: 200, text: async () => html } as Response
}

describe("FilelistAdapter.fetchStats — user-id resolution", () => {
  const adapter = new FilelistAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("sends the pasted cookies and copied User-Agent on the wire", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(okPage(FULL_PAGE))

    await adapter.fetchStats("https://filelist.io", VALID_TOKEN, "")

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [, init] = fetchSpy.mock.calls[0]
    const headers = init?.headers as Record<string, string>
    expect(headers.Cookie).toBe("uid=1683565; pass=abc123def456")
    expect(headers["User-Agent"]).toBe("Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestUA")
  })

  it("uses options.remoteUserId over the uid cookie, with a single fetch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(okPage(FULL_PAGE))

    const stats = await adapter.fetchStats("https://filelist.io", VALID_TOKEN, "", {
      remoteUserId: 9001,
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe("https://filelist.io/userdetails.php?id=9001")
    expect(stats.remoteUserId).toBe(9001)
  })

  it("takes the id from the uid cookie when remoteUserId is not cached", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(okPage(FULL_PAGE))

    const stats = await adapter.fetchStats("https://filelist.io", VALID_TOKEN, "")

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe("https://filelist.io/userdetails.php?id=1683565")
    expect(stats.remoteUserId).toBe(1683565)
  })

  it("bootstraps the id from the homepage logout link when neither source has it", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(HEADER_ONLY_PAGE))
      .mockResolvedValueOnce(okPage(FULL_PAGE))

    const stats = await adapter.fetchStats("https://filelist.io", NO_UID_TOKEN, "")

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[0][0]).toBe("https://filelist.io/")
    expect(fetchSpy.mock.calls[1][0]).toBe("https://filelist.io/userdetails.php?id=1683565")
    expect(stats.username).toBe("BrotherMayIhaveSomeLoops")
    expect(stats.remoteUserId).toBe(1683565)
  })

  it("throws without a second fetch when the bootstrap page has no profile link", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(okPage(LOGIN_PAGE))

    await expect(adapter.fetchStats("https://filelist.io", NO_UID_TOKEN, "")).rejects.toThrow(
      "Could not find a profile link on the FileList homepage. The page may not be authenticated"
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe("FilelistAdapter.fetchStats — redirects and network errors", () => {
  const adapter = new FilelistAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("throws session-expired when a 302 points at the login page", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "/login.php" } })
    )

    await expect(adapter.fetchStats("https://filelist.io", VALID_TOKEN, "")).rejects.toThrow(
      "Session expired. Browser cookies need to be refreshed"
    )
  })

  it("follows a benign same-origin redirect", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "/userdetails.php?id=1683565&mobile=0" },
        })
      )
      .mockResolvedValueOnce(okPage(FULL_PAGE))

    const stats = await adapter.fetchStats("https://filelist.io", VALID_TOKEN, "")
    expect(stats.username).toBe("BrotherMayIhaveSomeLoops")
  })

  it("refuses an off-origin redirect without replaying credentials", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "https://evil.example/steal" } })
      )
      .mockRejectedValue(new Error("unexpected fetch"))

    await expect(adapter.fetchStats("https://filelist.io", VALID_TOKEN, "")).rejects.toThrow(
      "FileList redirected off-site; refusing to send credentials"
    )
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("unwraps TypeError wrapping ECONNREFUSED", async () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED 192.0.2.1:443"), {
      code: "ECONNREFUSED",
    })
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(adapter.fetchStats("https://filelist.io", VALID_TOKEN, "")).rejects.toThrow(
      "Failed to connect to filelist.io: ECONNREFUSED"
    )
  })

  it("unwraps TypeError wrapping ENOTFOUND", async () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND filelist.io"), {
      code: "ENOTFOUND",
    })
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new TypeError("fetch failed", { cause }))

    await expect(adapter.fetchStats("https://filelist.io", VALID_TOKEN, "")).rejects.toThrow(
      "Failed to connect to filelist.io: ENOTFOUND"
    )
  })

  it("reports a timeout with the seam's wording", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      Object.assign(new Error("The operation was aborted due to timeout"), {
        name: "TimeoutError",
      })
    )

    await expect(adapter.fetchStats("https://filelist.io", VALID_TOKEN, "")).rejects.toThrow(
      "Request to filelist.io timed out"
    )
  })
})

describe("FilelistAdapter.fetchRaw", () => {
  const adapter = new FilelistAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a single successful User Details entry when the id is known", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okPage(FULL_PAGE))

    const calls = await adapter.fetchRaw("https://filelist.io", VALID_TOKEN, "")

    expect(calls).toHaveLength(1)
    expect(calls[0].label).toBe("User Details Page")
    expect(calls[0].endpoint).toBe("/userdetails.php?id=1683565")
    expect(calls[0].error).toBeNull()
    expect((calls[0].data as { username: string }).username).toBe("BrotherMayIhaveSomeLoops")
  })

  it("captures a parse failure as an error entry instead of throwing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(okPage(LOGIN_PAGE))

    const calls = await adapter.fetchRaw("https://filelist.io", VALID_TOKEN, "")

    expect(calls).toHaveLength(1)
    expect(calls[0].data).toBeNull()
    expect(calls[0].error).toBe("Session expired. Browser cookies need to be refreshed")
  })

  it("throws immediately on invalid credentials before any fetch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(new Error("unexpected fetch"))

    await expect(adapter.fetchRaw("https://filelist.io", "not-json", "")).rejects.toThrow(
      "FileList credentials"
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("emits the bootstrap as its own preceding entry", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(okPage(HEADER_ONLY_PAGE))
      .mockResolvedValueOnce(okPage(FULL_PAGE))

    const calls = await adapter.fetchRaw("https://filelist.io", NO_UID_TOKEN, "")

    expect(calls).toHaveLength(2)
    expect(calls[0].label).toBe("Home Page (user id lookup)")
    expect(calls[0].endpoint).toBe("/")
    expect(calls[0].data).toEqual({ userId: 1683565 })
    expect(calls[0].error).toBeNull()
    expect(calls[1].label).toBe("User Details Page")
    expect(calls[1].endpoint).toBe("/userdetails.php?id=1683565")
    expect(calls[1].error).toBeNull()
  })

  it("short-circuits after a failed bootstrap", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValueOnce(
      Object.assign(new Error("The operation was aborted due to timeout"), {
        name: "TimeoutError",
      })
    )

    const calls = await adapter.fetchRaw("https://filelist.io", NO_UID_TOKEN, "")

    expect(calls).toHaveLength(1)
    expect(calls[0].label).toBe("Home Page (user id lookup)")
    expect(calls[0].data).toBeNull()
    expect(calls[0].error).toBe("Request to filelist.io timed out")
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

describe("FilelistAdapter — proxy routing", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("routes through proxyFetch with the copied UA and never falls back to a direct fetch", async () => {
    const proxyFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      buffer: async () => Buffer.from(FULL_PAGE),
    })
    vi.doMock("@/lib/tunnel", () => ({ proxyFetch }))

    const { FilelistAdapter: FreshAdapter } = await import("./filelist")
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(new Error("unexpected fetch"))

    const stats = await new FreshAdapter().fetchStats("https://filelist.io", VALID_TOKEN, "", {
      proxyAgent: {} as never,
    })

    expect(stats.username).toBe("BrotherMayIhaveSomeLoops")
    expect(proxyFetch).toHaveBeenCalledTimes(1)
    // The session is fingerprinted against the browser UA that minted the
    // cookies; a direct fetch here would also leak the user's real IP past
    // their tunnel.
    expect(proxyFetch.mock.calls[0][2].headers["User-Agent"]).toBe(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestUA"
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.doUnmock("@/lib/tunnel")
  })
})
