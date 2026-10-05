"""Small builders that keep the seed source compact."""


def T(pt, en):
    """Translatable free text: Portuguese (filled by the company) + English (reviewed by the team)."""
    return {'pt': pt, 'en': en}


def ms(year, m=None, s=None, pt=None, en=None):
    """A period (month/year or semester/year). With pt/en it becomes a milestone."""
    period = {'year': year, 'month': m} if m else {'year': year, 'semester': s}
    if pt is None:
        return period
    return {'period': period, 'description': T(pt, en)}


def rnd(stage, period, amount_usd, purpose_pt, purpose_en):
    return {'stage': stage, 'period': period, 'amount_usd': amount_usd, 'purpose': T(purpose_pt, purpose_en)}


def raised(source, amount_usd, note=None):
    item = {'source': source, 'amount_usd': amount_usd}
    if note:
        item['note'] = note
    return item


def rev(amount_usd, year, pre=False):
    return {'pre_revenue': True} if pre else {'amount_usd': amount_usd, 'year': year}


def unsplash(photo, w, h):
    return 'https://images.unsplash.com/%s?q=80&w=%d&h=%d&auto=format&fit=crop' % (photo, w, h)


def picsum(seed, w, h):
    return 'https://picsum.photos/seed/%s/%d/%d' % (seed, w, h)
