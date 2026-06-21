from app.core.redis import encode_geohash


def test_encode_geohash_gangnam():
    # Gangnam Station
    lat, lng = 37.4979, 127.0276
    geohash = encode_geohash(lat, lng, precision=7)
    assert geohash == 'wydm6d6'
    assert len(geohash) == 7


def test_encode_geohash_hongdae():
    # Hongdae Entrance Station
    lat, lng = 37.5574, 126.9258
    geohash = encode_geohash(lat, lng, precision=7)
    assert geohash == 'wydm8m0'
    assert len(geohash) == 7
