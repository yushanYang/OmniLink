// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DeviceRegistry
 * @notice OmniLink 链上信任层核心合约。
 *         负责设备身份(DID)注册、所有权绑定、以及带时间限制的访问授权/撤销。
 *         数据传输走 P2P(WebRTC)，本合约只承载"信任"：谁拥有设备、谁被授权、何时到期。
 *
 * @dev MVP 范围（对应一周冲刺计划 Day 2）：
 *      - registerDevice / bindOwner
 *      - grantAccess(含 expiry) / revokeAccess
 *      - checkAccess(view，含时间限制自动失效)
 *      中继激励结算（RelayIncentive）属于第 2 周，单独成约。
 */
contract DeviceRegistry {
    struct Device {
        string deviceId;     // 设备 DID（链下生成的唯一标识）
        string pubkey;       // 设备公钥（文本形式，可用 hex/base58 表示）
        address owner;       // 所有者地址；address(0) 表示尚未认领
        string connInfo;     // 连接信息（如 signaling 房间号 / 多地址）
        bool registered;     // 是否已注册
    }

    // deviceKey = keccak256(deviceId) => Device
    mapping(bytes32 => Device) private devices;
    // deviceKey => (user => 授权到期时间戳; 0 表示无授权; type(uint256).max 表示永久)
    mapping(bytes32 => mapping(address => uint256)) private accessExpiry;

    bytes32[] private deviceKeys;

    event DeviceRegistered(bytes32 indexed deviceKey, string deviceId, address indexed registrant);
    event OwnerBound(bytes32 indexed deviceKey, address indexed owner);
    event AccessGranted(bytes32 indexed deviceKey, address indexed user, uint256 expiry);
    event AccessRevoked(bytes32 indexed deviceKey, address indexed user);
    event ConnInfoUpdated(bytes32 indexed deviceKey, string connInfo);

    modifier onlyOwner(bytes32 deviceKey) {
        require(devices[deviceKey].registered, "device not registered");
        require(devices[deviceKey].owner == msg.sender, "not device owner");
        _;
    }

    function _key(string memory deviceId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(deviceId));
    }

    /**
     * @notice 设备自注册身份(DID)。任何人可注册，但所有者初始为空，需后续认领。
     */
    function registerDevice(string calldata deviceId, string calldata pubkey, string calldata connInfo) external {
        bytes32 key = _key(deviceId);
        require(!devices[key].registered, "device already registered");

        Device storage device = devices[key];
        device.deviceId = deviceId;
        device.pubkey = pubkey;
        device.owner = address(0);
        device.connInfo = connInfo;
        device.registered = true;
        deviceKeys.push(key);

        emit DeviceRegistered(key, deviceId, msg.sender);
    }

    /**
     * @notice 用户"一键认领"设备所有权。仅当设备尚未被认领时可用。
     */
    function bindOwner(string calldata deviceId) external {
        bytes32 key = _key(deviceId);
        require(devices[key].registered, "device not registered");
        require(devices[key].owner == address(0), "device already claimed");

        devices[key].owner = msg.sender;
        // 所有者默认拥有永久访问权
        accessExpiry[key][msg.sender] = type(uint256).max;

        emit OwnerBound(key, msg.sender);
        emit AccessGranted(key, msg.sender, type(uint256).max);
    }

    /**
     * @notice 所有者授予某用户访问权，expiry 为 Unix 时间戳；传 0 表示永久。
     */
    function grantAccess(string calldata deviceId, address user, uint256 expiry) external onlyOwner(_key(deviceId)) {
        require(user != address(0), "invalid user");
        bytes32 key = _key(deviceId);
        uint256 stored = expiry == 0 ? type(uint256).max : expiry;
        accessExpiry[key][user] = stored;
        emit AccessGranted(key, user, stored);
    }

    /**
     * @notice 所有者撤销某用户访问权。
     */
    function revokeAccess(string calldata deviceId, address user) external onlyOwner(_key(deviceId)) {
        bytes32 key = _key(deviceId);
        accessExpiry[key][user] = 0;
        emit AccessRevoked(key, user);
    }

    /**
     * @notice 更新设备连接信息（如 signaling 房间号）。
     */
    function updateConnInfo(string calldata deviceId, string calldata connInfo) external onlyOwner(_key(deviceId)) {
        bytes32 key = _key(deviceId);
        devices[key].connInfo = connInfo;
        emit ConnInfoUpdated(key, connInfo);
    }

    /**
     * @notice 校验某用户当前是否有权访问设备（含时间限制自动失效）。
     */
    function checkAccess(string calldata deviceId, address user) external view returns (bool) {
        bytes32 key = _key(deviceId);
        uint256 exp = accessExpiry[key][user];
        if (exp == 0) return false;
        if (exp == type(uint256).max) return true;
        return block.timestamp < exp;
    }

    function getDevice(string calldata deviceId)
        external
        view
        returns (string memory id, string memory pubkey, address owner, string memory connInfo, bool registered)
    {
        Device storage d = devices[_key(deviceId)];
        return (d.deviceId, d.pubkey, d.owner, d.connInfo, d.registered);
    }

    function deviceCount() external view returns (uint256) {
        return deviceKeys.length;
    }

    function deviceKeyAt(uint256 index) external view returns (bytes32) {
        require(index < deviceKeys.length, "index out of range");
        return deviceKeys[index];
    }
}
