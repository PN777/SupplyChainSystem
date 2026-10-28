import numpy as np
import pandas as pd


def inventory_value(products):
    return float(sum(p.current_stock * p.unit_cost for p in products))


def stock_turnover(cogs, average_inventory):
    if cogs is None or average_inventory in (None, 0):
        return None
    return float(cogs / average_inventory)


def moving_average(series, window=7):
    if not series:
        return []
    s = pd.Series(series)
    return s.rolling(window=window, min_periods=1).mean().tolist()
