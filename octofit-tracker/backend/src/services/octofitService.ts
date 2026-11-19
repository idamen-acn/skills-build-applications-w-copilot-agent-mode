import { Types } from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

export async function listActivities() {
  return Activity.find().lean();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

export async function createActivity(input: unknown) {
  if (!isRecord(input)) throw badRequest('Activity details are required');

  const { userId, teamId, type, minutes } = input;
  if (
    typeof userId !== 'string' ||
    typeof teamId !== 'string' ||
    !Types.ObjectId.isValid(userId) ||
    !Types.ObjectId.isValid(teamId)
  ) {
    throw badRequest('Valid user and team IDs are required');
  }
  if (typeof type !== 'string' || !type.trim() || typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    throw badRequest('Activity type and positive minutes are required');
  }

  const [user, team] = await Promise.all([User.exists({ _id: userId }), Team.exists({ _id: teamId })]);
  if (!user || !team) throw badRequest('User or team was not found');

  return Activity.create({
    user: userId,
    team: teamId,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!isRecord(input)) throw badRequest('Team details are required');

  const { name, mascot } = input;
  if (typeof name !== 'string' || !name.trim() || typeof mascot !== 'string' || !mascot.trim()) {
    throw badRequest('Team name and mascot are required');
  }

  let members: string[] = [];
  if (input.members !== undefined) {
    if (!Array.isArray(input.members) || !input.members.every((member): member is string => typeof member === 'string' && Types.ObjectId.isValid(member))) {
      throw badRequest('Team members must be valid user IDs');
    }
    members = input.members;
    const uniqueMemberIds = new Set(members);
    const existingMembers = await User.countDocuments({ _id: { $in: [...uniqueMemberIds] } });
    if (existingMembers !== uniqueMemberIds.size) throw badRequest('One or more team members were not found');
  }

  return Team.create({ name: name.trim(), mascot: mascot.trim(), members });
}

export async function getLeaderboard() {
  const standings = await Activity.aggregate<{ teamName: string; totalPoints: number }>([
    { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    {
      $lookup: {
        from: Team.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'team',
      },
    },
    { $unwind: '$team' },
    { $sort: { totalPoints: -1, 'team.name': 1 } },
    { $project: { _id: 0, teamName: '$team.name', totalPoints: 1 } },
  ]);
  return standings.map(({ teamName, totalPoints }, index) => ({ teamName, totalPoints, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail }).lean();
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const recentActivity = await Activity.findOne({ user: user._id }).sort({ occurredAt: -1, _id: -1 }).lean();
  const goalWorkouts = await Workout.find({ focus: user.fitnessGoal }).sort({ title: 1 }).lean();

  let workouts = goalWorkouts;
  let reason = `Matches your ${user.fitnessGoal} fitness goal`;
  if (recentActivity) reason += ` and recent ${recentActivity.type} activity`;
  reason += '.';

  if (workouts.length === 0 && recentActivity) {
    const activityFocus = ['run', 'cycle', 'walk'].includes(recentActivity.type) ? 'endurance' : recentActivity.type;
    workouts = await Workout.find({ focus: activityFocus }).sort({ title: 1 }).lean();
    reason = `Matches your recent ${recentActivity.type} activity.`;
  }

  return workouts.map((workout) => ({ ...workout, reason }));
}

export { User };
