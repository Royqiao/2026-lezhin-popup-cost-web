import math

class CostCalculator:
    @staticmethod
    def calculate(work, event, buy_episodes, coin_to_krw=120, krw_to_cny=5.3):
        """
        计算购买成本、返还与法币折算
        """
        original_ep_cost = work.get("original_coin_per_ep", 3)
        event_ep_cost = event.get("pay_coin", original_ep_cost)
        cashback_ratio = event.get("cashback_ratio", 0.0)

        # 1. 原价总额
        original_total = buy_episodes * original_ep_cost

        # 2. 实际支付代币
        discounted_pay = math.ceil(buy_episodes * event_ep_cost)

        # 3. 返还代币/积分
        cashback_amount = math.floor(discounted_pay * cashback_ratio)

        # 4. 净消耗代币
        net_coin_cost = discounted_pay - cashback_amount

        # 5. 折算人民币 (Ridibooks 本身就是以韩元为单位)
        if work.get("platform") == "Ridibooks":
            krw_total = net_coin_cost
        else:
            krw_total = net_coin_cost * coin_to_krw

        cny_total = round((krw_total / 1000.0) * krw_to_cny, 2)

        return {
            "original_total": original_total,
            "discounted_pay": discounted_pay,
            "cashback_amount": cashback_amount,
            "net_coin_cost": net_coin_cost,
            "cny_cost": cny_total
        }
