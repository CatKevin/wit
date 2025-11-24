/// Module: wit_repository::repository
/// Description: This module implements the core logic for the Withub decentralized repository system.
/// It manages repository state, ownership, collaborators, and the reference to the latest commit (head).
module wit_repository::repository {
    use sui::event;
    use wit_repository::whitelist::{Self, Whitelist, Cap as WhitelistCap};

    /// Struct representing a decentralized repository.
    /// It holds the metadata and the current state of the repository.
    public struct Repository has key, store {
        id: UID,
        /// The address of the repository owner.
        owner: address,
        /// List of collaborator addresses who have write access.
        collaborators: vector<address>,
        /// The Walrus Blob ID of the current head commit (optional).
        head_commit: Option<vector<u8>>,
        /// The Walrus Blob ID of the current head manifest (optional, for quick access).
        head_manifest: Option<vector<u8>>,
        /// The Walrus Blob ID of the current head quilt (optional, for quick access).
        head_quilt: Option<vector<u8>>,
        /// The current version of the repository, incremented on every update.
        /// Used for optimistic concurrency control.
        version: u64,
        /// The Seal Policy ID used for encryption (optional, for private repositories).
        /// This corresponds to the Whitelist object ID.
        seal_policy_id: Option<vector<u8>>,
        /// The capability to manage the associated whitelist (if private).
        whitelist_cap: Option<WhitelistCap>,
        /// The name of the repository.
        name: vector<u8>,
        /// A brief description of the repository.
        description: vector<u8>,
    }

    /// Event emitted when the repository head is updated.
    /// Indexers can listen to this event to track repository updates.
    public struct HeadUpdatedEvent has copy, drop {
        /// The ID of the repository that was updated.
        repo_id: address,
        /// The new head commit Blob ID.
        new_commit: vector<u8>,
        /// The new head manifest Blob ID.
        new_manifest: vector<u8>,
        /// The new head quilt Blob ID.
        new_quilt: vector<u8>,
        /// The new version of the repository.
        version: u64,
        /// The parent commit Blob ID (for history tracking).
        parent: Option<vector<u8>>,
    }

    /// Event emitted when a new repository is created.
    public struct RepositoryCreatedEvent has copy, drop {
        repo_id: address,
        owner: address,
        name: vector<u8>,
    }

    /// Event emitted when a collaborator is added.
    public struct CollaboratorAddedEvent has copy, drop {
        repo_id: address,
        user_address: address,
    }

    /// Event emitted when a collaborator is removed.
    public struct CollaboratorRemovedEvent has copy, drop {
        repo_id: address,
        user_address: address,
    }

    /// Event emitted when repository ownership is transferred.
    public struct OwnershipTransferredEvent has copy, drop {
        repo_id: address,
        old_owner: address,
        new_owner: address,
    }

    // Event emitted when the seal policy is updated.
    // public struct SealPolicyUpdatedEvent has copy, drop {
    //     repo_id: address,
    //     new_policy_id: Option<vector<u8>>,
    // }

    /// Event emitted when repository information (name, description) is updated.
    public struct RepoInfoUpdatedEvent has copy, drop {
        repo_id: address,
        name: vector<u8>,
        description: vector<u8>,
    }

    // === Errors ===
    const ENotAuthorized: u64 = 1;
    const EVersionMismatch: u64 = 2;
    const EParentMismatch: u64 = 3;
    const EIsPrivateRepo: u64 = 4;
    const EIsPublicRepo: u64 = 5;
    // const EInvalidWhitelist: u64 = 6;

    /// Updates the repository name and description.
    /// Only the owner can update this information.
    public fun update_repo_info(
        repo: &mut Repository,
        name: vector<u8>,
        description: vector<u8>,
        ctx: &TxContext,
    ) {
        assert!(ctx.sender() == repo.owner, ENotAuthorized);
        repo.name = name;
        repo.description = description;

        event::emit(RepoInfoUpdatedEvent {
            repo_id: object::uid_to_address(&repo.id),
            name,
            description,
        });
    }

    /// Creates a new repository and shares it as a shared object.
    ///
    /// # Arguments
    /// * `name` - The name of the repository.
    /// * `description` - A brief description.
    /// * `is_private` - Whether to create a private repository (with Whitelist).
    /// * `ctx` - The transaction context.
    public fun create_repo(
        name: vector<u8>,
        description: vector<u8>,
        is_private: bool,
        ctx: &mut TxContext,
    ) {
        let id = object::new(ctx);
        let repo_id = object::uid_to_address(&id);
        let owner = ctx.sender();

        let (seal_policy_id, whitelist_cap) = if (is_private) {
            let (cap, mut wl) = whitelist::create_whitelist(ctx);
            // Add owner to whitelist by default
            whitelist::add(&mut wl, &cap, owner);
            
            let policy_id = object::id(&wl).to_bytes();
            whitelist::share_whitelist(wl);
            (option::some(policy_id), option::some(cap))
        } else {
            (option::none(), option::none())
        };

        let repo = Repository {
            id,
            owner,
            collaborators: vector[],
            head_commit: option::none(),
            head_manifest: option::none(),
            head_quilt: option::none(),
            version: 0,
            seal_policy_id,
            whitelist_cap,
            name: name,
            description,
        };
        
        event::emit(RepositoryCreatedEvent {
            repo_id,
            owner,
            name: repo.name,
        });

        transfer::public_share_object(repo);
    }

    /// Adds a collaborator to a PUBLIC repository.
    public fun add_collaborator(repo: &mut Repository, addr: address, ctx: &TxContext) {
        assert!(is_owner_or_collaborator(repo, ctx.sender()), ENotAuthorized);
        assert!(repo.whitelist_cap.is_none(), EIsPrivateRepo);
        
        if (!contains(&repo.collaborators, addr)) {
            repo.collaborators.push_back(addr);
            event::emit(CollaboratorAddedEvent {
                repo_id: object::uid_to_address(&repo.id),
                user_address: addr,
            });
        }
    }

    /// Adds a collaborator to a PRIVATE repository.
    /// Requires the Whitelist shared object to update access.
    public fun add_private_collaborator(
        repo: &mut Repository, 
        wl: &mut Whitelist, 
        addr: address, 
        ctx: &TxContext
    ) {
        assert!(is_owner_or_collaborator(repo, ctx.sender()), ENotAuthorized);
        assert!(repo.whitelist_cap.is_some(), EIsPublicRepo);
        
        let cap = repo.whitelist_cap.borrow();
        whitelist::add(wl, cap, addr);

        if (!contains(&repo.collaborators, addr)) {
            repo.collaborators.push_back(addr);
            event::emit(CollaboratorAddedEvent {
                repo_id: object::uid_to_address(&repo.id),
                user_address: addr,
            });
        }
    }

    /// Removes a collaborator from a PUBLIC repository.
    public fun remove_collaborator(repo: &mut Repository, addr: address, ctx: &TxContext) {
        assert!(ctx.sender() == repo.owner, ENotAuthorized);
        assert!(repo.whitelist_cap.is_none(), EIsPrivateRepo);
        
        remove_from_collaborators(repo, addr);
    }

    /// Removes a collaborator from a PRIVATE repository.
    public fun remove_private_collaborator(
        repo: &mut Repository, 
        wl: &mut Whitelist, 
        addr: address, 
        ctx: &TxContext
    ) {
        assert!(ctx.sender() == repo.owner, ENotAuthorized);
        assert!(repo.whitelist_cap.is_some(), EIsPublicRepo);

        let cap = repo.whitelist_cap.borrow();
        // It's safe to call remove even if not in whitelist (it asserts, but we can check or let it fail)
        // whitelist::remove asserts ENotInWhitelist. 
        // To be safe and idempotent, we could check first if whitelist exposed contains, 
        // but whitelist::remove is strict. 
        // Let's assume the caller knows what they are doing or the UI handles it.
        whitelist::remove(wl, cap, addr);
        
        remove_from_collaborators(repo, addr);
    }

    /// Transfers ownership of a PUBLIC repository.
    public fun transfer_ownership(repo: &mut Repository, new_owner: address, ctx: &TxContext) {
        let sender = ctx.sender();
        assert!(sender == repo.owner, ENotAuthorized);
        assert!(repo.whitelist_cap.is_none(), EIsPrivateRepo);
        
        perform_transfer(repo, sender, new_owner);
    }

    /// Transfers ownership of a PRIVATE repository.
    public fun transfer_ownership_private(
        repo: &mut Repository, 
        wl: &mut Whitelist, 
        new_owner: address, 
        ctx: &TxContext
    ) {
        let sender = ctx.sender();
        assert!(sender == repo.owner, ENotAuthorized);
        assert!(repo.whitelist_cap.is_some(), EIsPublicRepo);

        let cap = repo.whitelist_cap.borrow();
        // Add new owner to whitelist. This is idempotent.
        whitelist::add(wl, cap, new_owner);

        perform_transfer(repo, sender, new_owner);
    }

    fun perform_transfer(repo: &mut Repository, old_owner: address, new_owner: address) {
        // Remove new owner from collaborators if present
        let len = repo.collaborators.length();
        let mut i = 0;
        while (i < len) {
            if (repo.collaborators[i] == new_owner) {
                repo.collaborators.swap_remove(i);
                break
            };
            i = i + 1;
        };

        // Add old owner as collaborator if not already there
        if (!contains(&repo.collaborators, old_owner)) {
            repo.collaborators.push_back(old_owner);
            event::emit(CollaboratorAddedEvent {
                repo_id: object::uid_to_address(&repo.id),
                user_address: old_owner,
            });
        };

        repo.owner = new_owner;

        event::emit(OwnershipTransferredEvent {
            repo_id: object::uid_to_address(&repo.id),
            old_owner,
            new_owner,
        });
    }

    fun remove_from_collaborators(repo: &mut Repository, addr: address) {
        let len = repo.collaborators.length();
        let mut i = 0;
        while (i < len) {
            if (repo.collaborators[i] == addr) {
                repo.collaborators.swap_remove(i);
                event::emit(CollaboratorRemovedEvent {
                    repo_id: object::uid_to_address(&repo.id),
                    user_address: addr,
                });
                break
            };
            i = i + 1;
        }
    }

    /// Updates the head of the repository to point to a new commit.
    public fun update_head(
        repo: &mut Repository,
        new_commit: vector<u8>,
        new_manifest: vector<u8>,
        new_quilt: vector<u8>,
        expected_version: u64,
        parent_commit: Option<vector<u8>>,
        ctx: &TxContext,
    ) {
        assert!(is_owner_or_collaborator(repo, ctx.sender()), ENotAuthorized);
        assert!(repo.version == expected_version, EVersionMismatch);
        assert!(option_bytes_eq(&repo.head_commit, &parent_commit), EParentMismatch);

        repo.head_commit = option::some(new_commit);
        repo.head_manifest = option::some(new_manifest);
        repo.head_quilt = option::some(new_quilt);
        repo.version = repo.version + 1;

        event::emit(HeadUpdatedEvent {
            repo_id: object::uid_to_address(&repo.id),
            new_commit,
            new_manifest,
            new_quilt,
            version: repo.version,
            parent: parent_commit,
        });
    }

    // === Internal Helper Functions ===

    fun is_owner_or_collaborator(repo: &Repository, addr: address): bool {
        if (addr == repo.owner) return true;
        contains(&repo.collaborators, addr)
    }

    fun contains(v: &vector<address>, addr: address): bool {
        let len = v.length();
        let mut i = 0;
        while (i < len) {
            if (v[i] == addr) return true;
            i = i + 1;
        };
        false
    }

    fun option_bytes_eq(a: &Option<vector<u8>>, b: &Option<vector<u8>>): bool {
        if (a.is_some() && b.is_some()) {
            let va = a.borrow();
            let vb = b.borrow();
            return bytes_eq(va, vb)
        };
        a.is_none() && b.is_none()
    }

    fun bytes_eq(a: &vector<u8>, b: &vector<u8>): bool {
        let lena = a.length();
        let lenb = b.length();
        if (lena != lenb) return false;
        let mut i = 0;
        while (i < lena) {
            if (a[i] != b[i]) return false;
            i = i + 1;
        };
        true
    }
}
