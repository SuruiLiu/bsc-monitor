const smartAddress = [
    "0xbf2499e4cda11eb33eea341ae425d85b6e93f028",
    "0xb04fd91a2bf70292c6c961232a37b0c1596f6bc2",
    "0x696223ca1ceadf80ee0e9cb05d5f0f39c71b7536",
    "0x8d73a36d78e2ae4a437053c9ce3be70d483ab74d",
    "0x6813cec8ae3b7b0f09d2db373711b99a5e0a7349",
    "0xa999171a1432c18ce403365acc2adfa5c2ec6091",
    "0xa9b809cfe8d95edbdd61603ba40081ba6da4f24b",
    "0x8df4a5527b19f4d6ca5e7bf1e243480a457813ce",
    "0x10d8f599ec37524ce6fab8db33b67c4e7080cc5c",
    "0xa65a2e8fd80d8af7cada920ab74966aad94da15f",
    "0x384d34692ee458711d0189164aca9a42693f8af0",
    "0x1a767ca9db9d2c6eafed3682b9db662725e70e69",
    "0x28dbdf586af5df30b2be07ebd5abc589dd3ab1b7",
    "0xbe01ca338ce5272e0ee3985643fef921231ef96a",
    "0x4521a15102e89af1795eeda7a78e472210955015",
    "0xba3a3979c8385b176bbc76318753bd2fefa80ac0",
    "0x28816c4c4792467390c90e5b426f198570e29307",        // cz address
    "0x29bbc2b5aff41a2143f7d28fe6944453178f1473",         // test
    "0x056b96ff5e6046b500cc2be5cd8d950d263f963f"          // test
];

// 添加地址到名称的映射
const addressToName = {
    "0xbf2499e4cda11eb33eea341ae425d85b6e93f028": "聪明钱1",
    "0xb04fd91a2bf70292c6c961232a37b0c1596f6bc2": "聪明钱2",
    "0x696223ca1ceadf80ee0e9cb05d5f0f39c71b7536": "聪明钱3",
    "0x8d73a36d78e2ae4a437053c9ce3be70d483ab74d": "聪明钱4",
    "0x6813cec8ae3b7b0f09d2db373711b99a5e0a7349": "聪明钱5",
    "0xa999171a1432c18ce403365acc2adfa5c2ec6091": "聪明钱6",
    "0xa9b809cfe8d95edbdd61603ba40081ba6da4f24b": "聪明钱7",
    "0x8df4a5527b19f4d6ca5e7bf1e243480a457813ce": "聪明钱8",
    "0x10d8f599ec37524ce6fab8db33b67c4e7080cc5c": "聪明钱9",
    "0xa65a2e8fd80d8af7cada920ab74966aad94da15f": "聪明钱10",
    "0x384d34692ee458711d0189164aca9a42693f8af0": "聪明钱11",
    "0x1a767ca9db9d2c6eafed3682b9db662725e70e69": "聪明钱12",
    "0x28dbdf586af5df30b2be07ebd5abc589dd3ab1b7": "聪明钱13",
    "0xbe01ca338ce5272e0ee3985643fef921231ef96a": "聪明钱14",
    "0x4521a15102e89af1795eeda7a78e472210955015": "聪明钱15",
    "0xba3a3979c8385b176bbc76318753bd2fefa80ac0": "聪明钱16",
    "0x28816c4c4792467390c90e5b426f198570e29307": "CZ赵长鹏",
    "0x29bbc2b5aff41a2143f7d28fe6944453178f1473": "测试钱包1",
    "0x056b96ff5e6046b500cc2be5cd8d950d263f963f": "测试钱包2"
};

export const sa = smartAddress;
export const getWalletName = (address) => addressToName[address.toLowerCase()] || "未知钱包";