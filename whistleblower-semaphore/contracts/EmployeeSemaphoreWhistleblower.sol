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

    struct ReportStatus {
        uint8 status;
        string note;
        uint256 updatedAt;
    }

    struct ReportMessage {
        uint256 id;
        uint256 reportId;
        uint8 senderRole;
        string ipfsCID;
        string contentHash;
        uint256 timestamp;
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
    uint256 public reportMessageCount;

    string public adminEncryptionPublicKey;

    mapping(uint256 => Company) public companies;
    mapping(uint256 => ReportGroup) public reportGroups;
    mapping(uint256 => Report) public reports;
    mapping(uint256 => ReportStatus) public reportStatuses;
    mapping(uint256 => ReportMessage) public reportMessages;
    mapping(uint256 => mapping(uint256 => bool)) public memberCommitmentExists;
    mapping(uint256 => bool) public usedNullifiers;

    event CompanyCreated(uint256 indexed companyId, string companyName, address indexed adminAddress);
    event ReportGroupCreated(uint256 indexed reportGroupId, uint256 indexed companyId, uint256 semaphoreGroupId, string topicName);
    event EmployeeMemberAdded(uint256 indexed reportGroupId, uint256 indexed identityCommitment);
    event EmployeeMemberRemoved(uint256 indexed reportGroupId, uint256 indexed identityCommitment);
    event AdminEncryptionPublicKeyUpdated(string publicKey);
    event ReportStatusUpdated(uint256 indexed reportId, uint256 indexed companyId, uint8 status, string note);
    event ReportMessageAdded(
        uint256 indexed messageId,
        uint256 indexed reportId,
        uint8 indexed senderRole,
        string ipfsCID,
        string contentHash,
        uint256 timestamp
    );
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

    function setCompanyAdminPublicKey(uint256 companyId, string calldata publicKey) external {
        Company storage company = companies[companyId];
        require(company.active, "Inactive company");
        require(bytes(publicKey).length > 0, "Empty key");
        require(msg.sender == owner || msg.sender == company.adminAddress, "Only company admin");
        company.adminPublicKey = publicKey;
        if (companyId == 1) {
            adminEncryptionPublicKey = publicKey;
        }
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

    function addEmployeeMember(uint256 reportGroupId, uint256 identityCommitment) external {
        ReportGroup memory rg = reportGroups[reportGroupId];
        require(rg.active, "Inactive group");
        require(msg.sender == owner || msg.sender == companies[rg.companyId].adminAddress, "Only company admin");
        require(!memberCommitmentExists[reportGroupId][identityCommitment], "Member already added");
        semaphore.addMember(rg.semaphoreGroupId, identityCommitment);
        memberCommitmentExists[reportGroupId][identityCommitment] = true;
        emit EmployeeMemberAdded(reportGroupId, identityCommitment);
    }

    function removeEmployeeMember(
        uint256 reportGroupId,
        uint256 identityCommitment,
        uint256[] calldata merkleProofSiblings
    ) external {
        ReportGroup memory rg = reportGroups[reportGroupId];
        require(rg.active, "Inactive group");
        require(msg.sender == owner || msg.sender == companies[rg.companyId].adminAddress, "Only company admin");
        require(memberCommitmentExists[reportGroupId][identityCommitment], "Member not found");
        semaphore.removeMember(rg.semaphoreGroupId, identityCommitment, merkleProofSiblings);
        memberCommitmentExists[reportGroupId][identityCommitment] = false;
        emit EmployeeMemberRemoved(reportGroupId, identityCommitment);
    }

    function updateReportStatus(uint256 reportId, uint8 status, string calldata note) external {
        Report storage report = reports[reportId];
        require(report.id != 0, "Report not found");
        require(status <= 4, "Invalid status");
        uint256 companyId = report.companyId;
        require(msg.sender == owner || msg.sender == companies[companyId].adminAddress, "Only company admin");
        reportStatuses[reportId] = ReportStatus({
            status: status,
            note: note,
            updatedAt: block.timestamp
        });
        emit ReportStatusUpdated(reportId, companyId, status, note);
    }

    function addReportMessage(
        uint256 reportId,
        uint8 senderRole,
        string calldata ipfsCID,
        string calldata contentHash
    ) external returns (uint256) {
        Report storage report = reports[reportId];
        require(report.id != 0, "Report not found");
        require(senderRole == 1 || senderRole == 2, "Invalid sender role");
        require(bytes(ipfsCID).length > 0, "Empty ipfsCID");
        require(bytes(contentHash).length > 0, "Empty contentHash");

        if (senderRole == 1) {
            uint256 companyId = report.companyId;
            require(msg.sender == owner || msg.sender == companies[companyId].adminAddress, "Only company admin");
        }

        reportMessageCount += 1;
        reportMessages[reportMessageCount] = ReportMessage({
            id: reportMessageCount,
            reportId: reportId,
            senderRole: senderRole,
            ipfsCID: ipfsCID,
            contentHash: contentHash,
            timestamp: block.timestamp,
            submittedBy: msg.sender
        });

        emit ReportMessageAdded(reportMessageCount, reportId, senderRole, ipfsCID, contentHash, block.timestamp);
        return reportMessageCount;
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

        require(proof.scope == _credentialScope(request), "Proof scope mismatch");
        require(proof.message == _credentialMessage(request), "Proof message mismatch");

        semaphore.validateProof(rg.semaphoreGroupId, proof);
        usedNullifiers[proof.nullifier] = true;

        uint256 reportId = _storeReport(request, proof.nullifier, proof.message, proof.scope, msg.sender);

        emit AnonymousReportSubmitted(
            reportId,
            request.companyId,
            request.reportGroupId,
            proof.nullifier,
            block.timestamp
        );
    }

    function _credentialScope(ReportSubmission calldata request) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(request.companyId, request.reportGroupId, request.period, request.reportSlot)));
    }

    function _credentialMessage(ReportSubmission calldata request) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(
            request.companyId,
            request.reportGroupId,
            request.period,
            request.reportSlot,
            REPORT_CREDENTIAL_MESSAGE_TAG
        )));
    }

    function _storeReport(
        ReportSubmission calldata request,
        uint256 nullifier,
        uint256 message,
        uint256 scope,
        address submittedBy
    ) internal returns (uint256 reportId) {
        reportCount += 1;
        reportId = reportCount;
        Report storage report = reports[reportId];
        report.id = reportId;
        report.companyId = request.companyId;
        report.reportGroupId = request.reportGroupId;
        report.ipfsCID = request.ipfsCID;
        report.contentHash = request.contentHash;
        report.period = request.period;
        report.reportSlot = request.reportSlot;
        report.timestamp = block.timestamp;
        report.nullifier = nullifier;
        report.message = message;
        report.scope = scope;
        report.submittedBy = submittedBy;
        reportStatuses[reportId] = ReportStatus({
            status: 0,
            note: "",
            updatedAt: block.timestamp
        });
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

        uint256 semaphoreGroupId = semaphore.createGroup(address(this), 0);
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
