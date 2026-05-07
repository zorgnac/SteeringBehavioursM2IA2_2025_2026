
BEGIN {
    LAST = 0
    LOG = "/dev/stderr"
#     LOG = "/dev/null"
    DELTA = 1
    KILL = 0
    X   = 0
    N   = 0
    MAX = 0
    LIMIT = 2
#     SURFACE = 1
    
    SCALE = 10
    BORDER = 2
    TOTAL = 1
    NTICKS=0
    NCIRCLES=0
    
    if (!START) START = 0
    START = 0
    STARTX = -1
    WIDTH = 50
}

END {
    if (Y > LIMIT) NTICKS++
    
    if (Y == 0)
	TICKS[NTICKS-1] = tick(X, (TOTAL-DELTA) "+" DELTA)
    else
	TICKS[NTICKS-1] = tick(X, TOTAL)
    
}
END {
    if (MAX > LIMIT) MAX = LIMIT
#     DX = X-STARTX
    if (X > WIDTH) {
	DX = WIDTH
	STARTX = X-DX
    }
    else {
	STARTX = 0
# 	 DX = X
	 DX = WIDTH
    }
    
    print "<svg xmlns='http://www.w3.org/2000/svg'"
    print "    viewBox='" (STARTX-BORDER) " -" (BORDER+SCALE*MAX) " " \
	(DX+2*BORDER) " " (SCALE*MAX+2*BORDER) "'"
#     print "    overflow='hidden'"
    print ">"
    print "<script href='../etc/curve.js'/>"
    print "<style>"
    print " path { vector-effect: non-scaling-stroke }"
    print " text { transform: scale(" (0.5/SCALE) ") }"
    print " #back { fill: grey; opacity: 0.1 }"
    print " .Past { fill: white; opacity: 0.75 }"
    print " .Plot { rx: 0.2; ry: " (0.2/SCALE) "; fill: blue; opacity:0.2}"
    print " .Tick, .Axis { stroke: black }"
    print " .Tick g { transform: scale(1," (-1/SCALE) ") }"
    print " .Tick text { stroke: none; text-anchor: middle; }"
    print " text.Y { text-anchor: end; transform: scale(" (0.5/SCALE) ") translate(-10px) }"
    print "</style>"
    
    print "<path id='back' d='M " STARTX ",-"(SCALE*MAX)
    print " h " DX " v " (SCALE*MAX) " h " (-DX) " z'/>"

    print "<g transform='scale(1,-" SCALE ")'>"
    print "<path class='Axis' d='M " STARTX ",0 L " X ",0'/>"
    print "<path class='Axis' d='M " STARTX ",1 L " X ",1'/>"
    print "<path class='Axis' d='M " STARTX ",0.1 L " X ",0.1'/>"
    print "<path class='Axis' d='M " STARTX ",0.01 L " X ",0.01'/>"
    
    print "<g id='scroll' transform='translate(0)'>"
    print "<path "
    print "  style='fill: none; stroke: blue'"
    print "  d='" D
    print "'/>"
    
    for (c in CIRCLES)
	print CIRCLES[c]
    
    for (t in TICKS)
	print TICKS[t]
    
    print "</g>"
    print "</g>"
    
    print "<path class='Past' d='M " (STARTX-BORDER) ",-" (BORDER+SCALE*MAX) \
	" h " BORDER " v " (SCALE*MAX+2*BORDER) " h -" BORDER " z'/>"
	 
    print "<text class='Y' x='" (STARTX*2*SCALE) "' y='-" ( 2*SCALE) "'>0.1</text>"
    print "<text class='Y' x='" (STARTX*2*SCALE) "' y='-" (20*SCALE) "'>1</text>"
    
    print "</svg>"
     
    }

# ------------------------------------------------------------------------
function tick(x,total,title,dy,   svg)
{
    if (!dy) dy=0
    
    svg = "<g class='Tick' transform='translate(" x ",0)'>"
    svg = svg "<g>"
    svg = svg "\n  <path d='M 0,-0.1 v 0.5'/>"
    svg = svg "\n  <text y='" ((2+dy)*SCALE) "'>" \
	"<title>" title "</title>" total "</text>"
    svg = svg "</g>\n</g>"
    return svg
}
function circle(x,y, title,    svg)
{
    if (y > LIMIT) y=LIMIT
    svg = "<ellipse cx='" x "' cy='" y "' class='Plot'>"
    svg = svg "\n  <title>" title "</title>"
    svg = svg "\n</ellipse>"
    return svg
}
    
match($0, /k([0-9]+)-t([0-9]+)/, m) {
    KILL = 0+m[1]
    TRACK= 0+m[2]
    
    N++

    if (TRACK > LAST) DELTA = TRACK-LAST
    else DELTA = TRACK
    
    LASTX = X
    if (SURFACE)
	X = X +  DELTA
    else
	X++
    
    TOTAL = TOTAL + DELTA
    if (TOTAL > START) {
	if (STARTX == -1) {
	     STARTX = X
	      D = "M " X "," (KILL/DELTA)
	      
	}
    
    #     print "+" DELTA "	" KILL "	" (DELTA/KILL) > LOG
	Y = (KILL/DELTA)
	if (Y > MAX) MAX = Y
	if (SURFACE)
	      D = D "\nL " LASTX "," Y
	D = D "\nL " X "," Y

	 CIRCLES[NCIRCLES++] = circle(X,Y, $0 )
	  # KILL " " TOTAL " " TRACK
	
	if (KILL > 10 || Y > LIMIT) {
	      TICKS[NTICKS++] = tick(X, "k=" KILL, TOTAL, 2)
	}
	
	if (N % 10 == 0)
	      TICKS[NTICKS++] = tick(X, TOTAL)
    }
    
    LAST = TRACK
}

