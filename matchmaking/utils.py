def geohash_encode(latitude, longitude, precision=12):
    """
    Encode a position into a geohash string.
    
    Ported from a standard Geohash implementation for pure-python high performance.
    """
    base32 = "0123456789bcdefghjkmnpqrstuvwxyz"
    
    lat_interval = [-90.0, 90.0]
    lon_interval = [-180.0, 180.0]
    
    geohash = []
    bits = [16, 8, 4, 2, 1]
    bit = 0
    ch = 0
    even = True
    
    while len(geohash) < precision:
        if even:
            mid = (lon_interval[0] + lon_interval[1]) / 2
            if longitude > mid:
                ch |= bits[bit]
                lon_interval[0] = mid
            else:
                lon_interval[1] = mid
        else:
            mid = (lat_interval[0] + lat_interval[1]) / 2
            if latitude > mid:
                ch |= bits[bit]
                lat_interval[0] = mid
            else:
                lat_interval[1] = mid
        
        even = not even
        if bit < 4:
            bit += 1
        else:
            geohash.append(base32[ch])
            bit = 0
            ch = 0
            
    return "".join(geohash)
