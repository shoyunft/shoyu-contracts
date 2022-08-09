import { defaultAbiCoder } from "@ethersproject/abi";

const OfferItem = `tuple(uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount)`;
const ConsiderationItem = `tuple(uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount, address recipient)`;
const OrderParameters = `tuple(address offerer, address zone, ${OfferItem}[] offer, ${ConsiderationItem}[] consideration, uint8 orderType, uint256 startTime, uint256 endTime, bytes32 zoneHash, uint256 salt, bytes32 conduitKey, uint256 totalOriginalConsiderationItems)`;
const AdvancedOrder = `tuple(${OrderParameters} parameters, uint120 numerator, uint120 denominator, bytes signature, bytes extraData)`;
const CriteriaResolver = `tuple(uint256 orderIndex, uint8 side, uint256 index, uint256 identifier, bytes32[] criteriaProof)`;

export function encodeFulfillAdvancedOrderParams(
  advancedOrder: any,
  criteriaResolvers: any[],
  fulfillerConduitKey: any,
  recipient: any
) {
  return defaultAbiCoder.encode(
    [AdvancedOrder, `${CriteriaResolver}[]`, "bytes32", "address"],
    [advancedOrder, criteriaResolvers, fulfillerConduitKey, recipient]
  );
}

const FulfillmentComponent = `tuple(uint256 orderIndex, uint256 itemIndex)`;

export function encodeFulfillAvailableAdvancedOrdersParams(
  advancedOrders: any[],
  criteriaResolvers: any[],
  offerFullfillments: any[][],
  considerationFulfillments: any[][],
  fulfillerConduitKey: any,
  recipient: any,
  maximumFulfilled: any
) {
  return defaultAbiCoder.encode(
    [
      `${AdvancedOrder}[]`,
      `${CriteriaResolver}[]`,
      `${FulfillmentComponent}[][]`,
      `${FulfillmentComponent}[][]`,
      "bytes32",
      "address",
      "uint256",
    ],
    [
      advancedOrders,
      criteriaResolvers,
      offerFullfillments,
      considerationFulfillments,
      fulfillerConduitKey,
      recipient,
      maximumFulfilled,
    ]
  );
}
