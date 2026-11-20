import base64, codecs
_=lambda x:base64.b64decode(x).decode()
__=lambda x:codecs.decode(x,'rot13')
print(__(_(b'U1lOVFtlM2lfY2wzX2Jvc2hmcDRnM3Fd')))
