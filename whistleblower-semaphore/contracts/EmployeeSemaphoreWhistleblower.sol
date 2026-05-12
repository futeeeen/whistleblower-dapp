// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

contract EmployeeSemaphoreWhistleblower {
    string private constant REPORT_CREDENTIAL_MESSAGE_TAG = "REPORT_CREDENTIAL_V1";

    struct Company {
        uint256 id;
        string companyName;
        string adminPublicKey;
        address adminAddress;
        bool active;
    }

    struct ReportGroup {
        uint256 id;
        uint256 companyId;
        string topicName;
        uint256 maxReportsPerMember;
        uint256 startTime;
        uint256 endTime;
        uint256 semaphoreGroupId;
        bool active;
    }

    struct Report {
        uint256 id;
        uint256 companyId;
        uint256 reportGroupId;
        string ipfsCID;
        string contentHash;
        string period;
        uint256 reportSlot;
        uint256 timestamp;
        uint256 nullifier;
        uint256 message;
        uint256 scope;
        address submittedBy;
    }

    struct ReportSubmission {
        uint256 companyId;
        uint256 reportGroupId;
        string ipfsCID;
        string contentHash;
        string period;
        uint256 reportSlot;
    }

    address public owner;
    ISemaphore public semaphore;
    uint256 public groupId;
    uint256 public companyCount;
    uint256 public reportGroupCount;
    uint256 public reportCount;

    string public adminEncryptionPublicKey;

    mapping(uint256 => Company) public companies;
    mapping(uint256 => ReportGroup) public reportGroups;
    mapping(uint256 => Report) public reports;
    mapping(uint256 => mapping(uint256 => bool)) public memberCommitmentExists;
    mapping(uint256 => bool) public usedNullifiers;

    event CompanyCreated(uint256 indexed companyId, string companyName, address indexed adminAddress);
    event ReportGroupCreated(uint256 indexed reportGroupId, uint256 indexed companyId, uint256 semaphoreGroupId, string topicName);
    event EmployeeMemberAdded(uint256 indexed reportGroupId, uint256 indexed identityCommitment);
    event AdminEncryptionPublicKeyUpdated(string publicKey);
    event AnonymousReportSubmitted(
        uint256 indexed reportId,
        uint256 indexed companyId,
        uint256 indexed reportGroupId,
        uint256 nullifier,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address semaphoreAddress) {
        owner = msg.sender;
        semaphore = ISemaphore(semaphoreAddress);
        _createCompany("Default Company", "", msg.sender);
        uint256 defaultReportGroupId = _createReportGroup(1, "Default Topic", 1, 0, type(uint256).max);
        groupId = reportGroups[defaultReportGroupId].semaphoreGroupId;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    function setAdminEncryptionPublicKey(string calldata publicKey) external onlyOwner {
        require(bytes(publicKey).length > 0, "Empty key");
        adminEncryptionPublicKey = publicKey;
        companies[1].adminPublicKey = publicKey;
        emit AdminEncryptionPublicKeyUpdated(publicKey);
    }

    function createCompany(
        string calldata companyName,
        string calldata publicKey,
        address adminAddress
    ) external onlyOwner returns (uint256) {
        return _createCompany(companyName, publicKey, adminAddress);
    }

    function createReportGroup(
        uint256 companyId,
        string calldata topicName,
        uint256 maxReportsPerMember,
        uint256 startTime,
        uint256 endTime
    ) external onlyOwner returns (uint256) {
        return _createReportGroup(companyId, topicName, maxReportsPerMember, startTime, endTime);
    }

    function addEmployeeMember(uint256 reportGroupId, uint256 identityCommitment) external onlyOwner {
        ReportGroup memory rg = reportGroups[reportGroupId];
        require(rg.active, "Inactive group");
        require(!memberCommitmentExists[reportGroupId][identityCommitment], "Member already added");
        semaphore.addMember(rg.semaphoreGroupId, identityCommitment);
        memberCommitmentExists[reportGroupId][identityCommitment] = true;
        emit EmployeeMemberAdded(reportGroupId, identityCommitment);
    }

    function submitAnonymousReport(
        ReportSubmission calldata request,
        ISemaphore.SemaphoreProof calldata proof
    ) external {
        ReportGroup memory rg = reportGroups[request.reportGroupId];
        require(companies[request.companyId].active, "Inactive company");
        require(rg.active, "Inactive group");
        require(rg.companyId == request.companyId, "Group/company mismatch");
        require(bytes(request.ipfsCID).length > 0, "Empty ipfsCID");
        require(bytes(request.contentHash).length > 0, "Empty contentHash");
        require(bytes(request.period).length > 0, "Empty period");
        require(request.reportSlot > 0 && request.reportSlot <= rg.maxReportsPerMember, "Invalid report slot");
        require(block.timestamp >= rg.startTime, "Group not started");
        require(block.timestamp <= rg.endTime, "Group ended");
        require(!usedNullifiers[proof.nullifier], "Nullifier already used");

        uint256 expectedScope = uint256(keccak256(abi.encodePacked(request.companyId, request.reportGroupId, request.period, request.reportSlot)));
        uint256 expectedMessage = uint256(keccak256(abi.encodePacked(request.companyId, request.reportGroupId, request.period, request.reportSlot, REPORT_CREDENTIAL_MESSAGE_TAG)));
        require(proof.scope == expectedScope, "Proof scope mismatch");
        require(proof.message == expectedMessage, "Proof message mismatch");

        semaphore.validateProof(rg.semaphoreGroupId, proof);
        usedNullifiers[proof.nullifier] = true;

        reportCount += 1;
        reports[reportCount] = Report({
            id: reportCount,
            companyId: request.companyId,
            reportGroupId: request.reportGroupId,
            ipfsCID: request.ipfsCID,
            contentHash: request.contentHash,
            period: request.period,
            reportSlot: request.reportSlot,
            timestamp: block.timestamp,
            nullifier: proof.nullifier,
            message: proof.message,
            scope: proof.scope,
            submittedBy: msg.sender
        });

        emit AnonymousReportSubmitted(
            reportCount,
            request.companyId,
            request.reportGroupId,
            proof.nullifier,
            block.timestamp
        );
    }

    function _createCompany(
        string memory companyName,
        string memory publicKey,
        address adminAddress
    ) internal returns (uint256) {
        require(bytes(companyName).length > 0, "Empty company name");
        require(adminAddress != address(0), "Zero admin");

        companyCount += 1;
        companies[companyCount] = Company({
            id: companyCount,
            companyName: companyName,
            adminPublicKey: publicKey,
            adminAddress: adminAddress,
            active: true
        });

        emit CompanyCreated(companyCount, companyName, adminAddress);
        return companyCount;
    }

    function _createReportGroup(
        uint256 companyId,
        string memory topicName,
        uint256 maxReportsPerMember,
        uint256 startTime,
        uint256 endTime
    ) internal returns (uint256) {
        require(companies[companyId].active, "Inactive company");
        require(bytes(topicName).length > 0, "Empty topic");
        require(maxReportsPerMember > 0, "Invalid max reports");
        require(endTime > startTime, "Invalid time range");

        uint256 semaphoreGroupId = semaphore.createGroup(address(this));
        reportGroupCount += 1;
        reportGroups[reportGroupCount] = ReportGroup({
            id: reportGroupCount,
            companyId: companyId,
            topicName: topicName,
            maxReportsPerMember: maxReportsPerMember,
            startTime: startTime,
            endTime: endTime,
            semaphoreGroupId: semaphoreGroupId,
            active: true
        });

        emit ReportGroupCreated(reportGroupCount, companyId, semaphoreGroupId, topicName);
        return reportGroupCount;
    }
}
