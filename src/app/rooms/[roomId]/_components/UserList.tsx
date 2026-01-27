import UserCard from "./UserCard";

const users = [
  { id: 3, name: "You", avatarId: "avatar-3", isSpeaking: false },
  { id: 1, name: "Sarah", avatarId: "avatar-1", isSpeaking: true },
  { id: 2, name: "Mike", avatarId: "avatar-2", isSpeaking: false },
  { id: 4, name: "David", avatarId: "avatar-4", isSpeaking: false },
  { id: 5, name: "Chloe", avatarId: "avatar-1", isSpeaking: false },
  { id: 6, name: "Alex", avatarId: "avatar-2", isSpeaking: false },
];

export default function UserList() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {users.map((user) => (
            <UserCard key={user.id} user={user} isLocal={user.name === "You"} />
        ))}
    </div>
  );
}
