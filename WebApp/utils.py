from __init__ import *
import datetime

def get_players_names():
    #returns the list of player names
    with open(os.path.join(database_path, 'players.csv'), 'r') as f:
        df = pd.read_csv(f)
        df['Full Name'] = df['Surname'] + ' ' + df['Name']
        return df['Full Name'].tolist()
    
def get_max_id():
    #returns the maximum id in the players database
    with open(os.path.join(database_path, 'players.csv'), 'r') as f:
        df = pd.read_csv(f)
        return df['ID'].max()
    
def get_player_id(name, surname):
    #returns the id of a player given his name and surname
    with open(os.path.join(database_path, 'players.csv'), 'r') as f:
        df = pd.read_csv(f, dtype={'ID': int})
        return df[(df['Name'] == name) & (df['Surname'] == surname)]['ID'].values[0]
    
def write_game_to_database(date, players, score):
    #writes a new game to the database
    with open(os.path.join(database_path, 'games.csv'), 'a') as f:
        f.write(f"{get_max_id() + 1},{date},{players},{score}\n")

def write_score_to_database(score, player_id, taker):
    date = str(get_month()) + '/' + str(get_year())
    df_month = pd.read_csv(os.path.join(database_path, f'scores_{date}.csv'), dtype={'ID': int, 'Ngames': int, 'HighestWin': int})
    df = pd.read_csv(os.path.join(database_path, 'scores.csv'),dtype={'ID': int, 'Ngames': int, 'HighestWin': int})
    #increase scores in the database for the player
    df.loc[df['ID'] == player_id, 'Ngames'] += 1
    df_month.loc[df_month['ID'] == player_id, 'Ngames'] += 1
    df.loc[df['ID'] == player_id, 'Score'] += score
    df_month.loc[df_month['ID'] == player_id, 'Score'] += score
    current_mean = df.loc[df['ID'] == player_id, 'Mean'].values[0]
    current_mean_month = df_month.loc[df_month['ID'] == player_id, 'Mean'].values[0]
    df.loc[df['ID'] == player_id, 'Mean'] = df.loc[df['ID'] == player_id, 'Score'] / df.loc[df['ID'] == player_id, 'Ngames']
    df_month.loc[df_month['ID'] == player_id, 'Mean'] = df_month.loc[df_month['ID'] == player_id, 'Score'] / df_month.loc[df_month['ID'] == player_id, 'Ngames']
    #compute new_std
    current_std = df.loc[df['ID'] == player_id, 'Std'].values[0]
    current_std_month = df_month.loc[df_month['ID'] == player_id, 'Std'].values[0]
    


    df.to_csv(os.path.join(database_path, 'scores.csv'), index=False)



def get_month():
    """
    Return the current month as an integer
    """
    return datetime.datetime.now().month

def get_year():
    """
    Return the current year as an integer
    """
    return datetime.datetime.now().year